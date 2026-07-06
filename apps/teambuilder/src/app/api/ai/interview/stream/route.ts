import type Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { getAnalyticsBinding, trackAIChat } from "@/lib/ai/analytics";
import { createAnthropicClient } from "@/lib/ai/anthropic-client";
import { logGatewayHealthOnce } from "@/lib/ai/gateway-health";
import {
    buildSynthesisSystemPrompt,
    formatAnswersForPrompt,
    INTERVIEW_STEPS,
} from "@/lib/ai/interview-prompts";
import { INTERVIEW_SYNTHESIS_TOOLS, type InterviewStepId } from "@/lib/ai/interview-tools";
import { checkOrigin, checkRateLimit, readJsonBody, validationError } from "@/lib/api/ai-guard";
import { InterviewRequestSchema } from "@/lib/api/ai-schemas";
import type { FormatId, Mode } from "@/types/pokemon";

// Interview runs are gated at a modest per-IP ceiling — well above the four
// expected client calls, low enough to mitigate abuse.
const RATE_LIMIT = { route: "interview", limit: 6, bindingName: "AI_RATE_LIMITER_STRICT" };

let eventCounter = 0;
function nextId(): string {
    return `evt_${++eventCounter}_${Date.now()}`;
}

function aguiEvent(data: Record<string, unknown>): string {
    return `data: ${JSON.stringify({ timestamp: Date.now(), ...data })}\n\n`;
}

function hasRequiredAnswers(answers: Partial<Record<InterviewStepId, string>>): boolean {
    for (const step of INTERVIEW_STEPS) {
        if (step.skippable) continue;
        const value = answers[step.id as InterviewStepId];
        if (!value?.trim()) return false;
    }
    return true;
}

export async function POST(request: NextRequest) {
    logGatewayHealthOnce("interview-stream");

    const originError = checkOrigin(request);
    if (originError) return originError;

    const rateLimitError = await checkRateLimit(request, RATE_LIMIT);
    if (rateLimitError) return rateLimitError;

    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const parsed = InterviewRequestSchema.safeParse(body.data);
    if (!parsed.success) {
        return validationError();
    }

    if (!hasRequiredAnswers(parsed.data.answers)) {
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

    const { answers } = parsed.data;
    const format = parsed.data.format as FormatId;
    const mode = parsed.data.mode as Mode;

    const systemPrompt = buildSynthesisSystemPrompt(format, mode);
    const userMessage = `Here are the trainer's answers:\n${formatAnswersForPrompt(answers)}\n\nBuild the team now.`;

    const client = createAnthropicClient("interview");

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

    // Capture the Analytics Engine binding in request context (see analytics.ts).
    const analytics = getAnalyticsBinding();

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

                trackAIChat(analytics, {
                    format,
                    personality: "_interview",
                    mode,
                    thinking: false,
                    inputTokens: finalMsg.usage.input_tokens ?? 0,
                    outputTokens: finalMsg.usage.output_tokens ?? 0,
                    cacheCreationTokens: finalMsg.usage.cache_creation_input_tokens ?? 0,
                    cacheReadTokens: finalMsg.usage.cache_read_input_tokens ?? 0,
                    teamSize: 0,
                    responseTimeMs: Math.round(performance.now() - streamStartTime),
                    source: "web",
                });

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
