import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { logGatewayHealthOnce } from "@/lib/ai/gateway-health";
import {
    buildSynthesisSystemPrompt,
    formatAnswersForPrompt,
    INTERVIEW_STEPS,
} from "@/lib/ai/interview-prompts";
import { INTERVIEW_SYNTHESIS_TOOLS, type InterviewStepId } from "@/lib/ai/interview-tools";
import type { FormatId, Mode } from "@/types/pokemon";

// Interview runs are gated at a modest per-IP ceiling — well above the four
// expected client calls, low enough to mitigate abuse.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 6;

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

function cleanupRateLimits() {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now > entry.resetAt) rateLimitMap.delete(ip);
    }
}
setInterval(cleanupRateLimits, 5 * 60_000);

let eventCounter = 0;
function nextId(): string {
    return `evt_${++eventCounter}_${Date.now()}`;
}

function aguiEvent(data: Record<string, unknown>): string {
    return `data: ${JSON.stringify({ timestamp: Date.now(), ...data })}\n\n`;
}

interface InterviewRequestBody {
    answers: Partial<Record<InterviewStepId, string>>;
    format: FormatId;
    mode: Mode;
}

function hasRequiredAnswers(body: InterviewRequestBody): boolean {
    for (const step of INTERVIEW_STEPS) {
        if (step.skippable) continue;
        const value = body.answers[step.id as InterviewStepId];
        if (!value || !value.trim()) return false;
    }
    return true;
}

export async function POST(request: NextRequest) {
    logGatewayHealthOnce("interview-stream");

    const clientIp =
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";

    if (isRateLimited(clientIp)) {
        return new Response(
            JSON.stringify({ error: "Too many requests. Wait a minute and try again." }),
            {
                status: 429,
                headers: { "Content-Type": "application/json", "Retry-After": "60" },
            },
        );
    }

    let body: InterviewRequestBody;
    try {
        body = (await request.json()) as InterviewRequestBody;
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (!hasRequiredAnswers(body)) {
        return new Response(
            JSON.stringify({
                error: "Missing required answers. Fill format and start before synthesizing.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: "Claude API key not configured" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { answers, format, mode } = body;

    const systemPrompt = buildSynthesisSystemPrompt(format, mode);
    const userMessage = `Here are the trainer's answers:\n${formatAnswersForPrompt(answers)}\n\nBuild the team now.`;

    const gatewayUrl = process.env.CLOUDFLARE_AI_GATEWAY_URL;
    const gatewayToken = process.env.CF_AIG_TOKEN;
    const client = new Anthropic({
        apiKey,
        ...(gatewayUrl && {
            baseURL: gatewayUrl,
            defaultHeaders: {
                ...(gatewayToken && { "cf-aig-authorization": `Bearer ${gatewayToken}` }),
                "cf-aig-metadata": JSON.stringify({ source: "interview" }),
            },
        }),
    });

    const stream = client.messages.stream(
        {
            model: "claude-sonnet-4-6",
            max_tokens: 16000,
            system: [
                {
                    type: "text",
                    text: systemPrompt,
                    cache_control: { type: "ephemeral" },
                },
            ],
            messages: [{ role: "user", content: userMessage }],
            tools: INTERVIEW_SYNTHESIS_TOOLS,
        },
        { signal: request.signal },
    );

    let currentToolId = "";
    let currentToolName = "";
    let toolInputSnapshot: unknown = null;
    let isInToolBlock = false;

    const encoder = new TextEncoder();
    const runId = nextId();
    const messageId = nextId();
    const streamStartTime = performance.now();

    const readable = new ReadableStream({
        async start(controller) {
            const emit = (data: string) => controller.enqueue(encoder.encode(data));

            try {
                emit(aguiEvent({ type: "RUN_STARTED", runId }));

                stream.on("streamEvent", (event) => {
                    if (event.type === "content_block_start") {
                        const blockType = event.content_block?.type;
                        if (blockType === "text") {
                            emit(
                                aguiEvent({
                                    type: "TEXT_MESSAGE_START",
                                    messageId,
                                    role: "assistant",
                                }),
                            );
                        } else if (blockType === "tool_use") {
                            isInToolBlock = true;
                            const block = event.content_block as Anthropic.Messages.ToolUseBlock;
                            currentToolId = block.id || nextId();
                            currentToolName = block.name || "";
                            toolInputSnapshot = null;
                            emit(
                                aguiEvent({
                                    type: "TOOL_CALL_START",
                                    toolCallId: currentToolId,
                                    toolName: currentToolName,
                                }),
                            );
                        }
                    }

                    if (event.type === "content_block_stop") {
                        if (isInToolBlock) {
                            if (currentToolName && toolInputSnapshot !== null) {
                                emit(
                                    aguiEvent({
                                        type: "TOOL_CALL_END",
                                        toolCallId: currentToolId,
                                        toolName: currentToolName,
                                        input: toolInputSnapshot,
                                    }),
                                );
                            }
                            isInToolBlock = false;
                            currentToolId = "";
                            currentToolName = "";
                            toolInputSnapshot = null;
                        }
                    }
                });

                stream.on("text", (delta) => {
                    emit(
                        aguiEvent({
                            type: "TEXT_MESSAGE_CONTENT",
                            messageId,
                            delta,
                        }),
                    );
                });

                stream.on("inputJson", (_partial, snapshot) => {
                    toolInputSnapshot = snapshot;
                });

                const finalMsg = await stream.finalMessage();

                emit(aguiEvent({ type: "TEXT_MESSAGE_END", messageId }));
                emit(
                    aguiEvent({
                        type: "RUN_FINISHED",
                        runId,
                        finishReason: "stop",
                        usage: {
                            promptTokens: finalMsg.usage.input_tokens ?? 0,
                            completionTokens: finalMsg.usage.output_tokens ?? 0,
                            totalTokens:
                                (finalMsg.usage.input_tokens ?? 0) +
                                (finalMsg.usage.output_tokens ?? 0),
                        },
                    }),
                );

                console.log(
                    JSON.stringify({
                        type: "interview_synthesis",
                        format,
                        mode,
                        inputTokens: finalMsg.usage.input_tokens ?? 0,
                        outputTokens: finalMsg.usage.output_tokens ?? 0,
                        responseTimeMs: Math.round(performance.now() - streamStartTime),
                        timestamp: Date.now(),
                    }),
                );

                controller.close();
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") {
                    emit(aguiEvent({ type: "RUN_FINISHED", runId, finishReason: "stop" }));
                    controller.close();
                    return;
                }

                console.error("Interview stream error:", err);
                emit(
                    aguiEvent({
                        type: "RUN_ERROR",
                        runId,
                        error: {
                            message: err instanceof Error ? err.message : "Unknown streaming error",
                        },
                    }),
                );
                controller.close();
            }
        },
        cancel() {
            stream.abort();
        },
    });

    return new Response(readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
