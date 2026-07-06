import type { NextRequest } from "next/server";
import { getAnalyticsBinding, trackAIChat } from "@/lib/ai/analytics";
import { createAnthropicClient } from "@/lib/ai/anthropic-client";
import {
    buildMetaReportSystemPrompt,
    buildMetaReportUserMessage,
    fetchMetaTrends,
} from "@/lib/ai/context";
import { logGatewayHealthOnce } from "@/lib/ai/gateway-health";
import { checkOrigin, checkRateLimit, readJsonBody, validationError } from "@/lib/api/ai-guard";
import { MetaReportRequestSchema } from "@/lib/api/ai-schemas";

// Opus 4.8 powers the metagame-evolution narrative — the most autonomous model
// for grounded analytical writing. Other AI routes stay on Sonnet for chat latency.
const MODEL = "claude-opus-4-8";

// Reports are heavier than chat turns, so the bucket is tighter (mirrors the
// interview route): 6 per minute per IP (shared guard, CF binding-backed).
const RATE_LIMIT = { route: "meta-report", limit: 6, bindingName: "AI_RATE_LIMITER_STRICT" };

// AG-UI event emitter helpers (same protocol as /api/ai/claude/stream so the
// client SSE parser is unified regardless of which route drives the stream).
let eventCounter = 0;
function nextId(): string {
    return `evt_${++eventCounter}_${Date.now()}`;
}

function aguiEvent(data: Record<string, unknown>): string {
    return `data: ${JSON.stringify({ timestamp: Date.now(), ...data })}\n\n`;
}

export async function POST(request: NextRequest) {
    logGatewayHealthOnce("meta-report-stream");

    const originError = checkOrigin(request);
    if (originError) return originError;

    const rateLimitError = await checkRateLimit(request, RATE_LIMIT);
    if (rateLimitError) return rateLimitError;

    try {
        const body = await readJsonBody(request);
        if (!body.ok) return body.response;

        const parsed = MetaReportRequestSchema.safeParse(body.data);
        if (!parsed.success) {
            return validationError();
        }
        const { format, window, mode } = parsed.data;

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Claude API key not configured" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Pull precomputed trend numbers from the MCP get_meta_trends tool. The
        // model narrates these — it never invents data.
        const trends = await fetchMetaTrends(format, window);
        if (!trends) {
            return new Response(
                JSON.stringify({ error: "Metagame trend data is unavailable right now." }),
                { status: 502, headers: { "Content-Type": "application/json" } },
            );
        }

        const systemPrompt = buildMetaReportSystemPrompt(format, mode);
        const userMessage = buildMetaReportUserMessage(format, window, trends);

        const streamStartTime = performance.now();

        // Capture the Analytics Engine binding in request context — the stream
        // body is pulled after this handler returns.
        const analytics = getAnalyticsBinding();
        const client = createAnthropicClient("web");

        const stream = client.messages.stream(
            {
                model: MODEL,
                max_tokens: 8000,
                system: [
                    {
                        type: "text",
                        text: systemPrompt,
                        cache_control: { type: "ephemeral" },
                    },
                ],
                messages: [{ role: "user", content: userMessage }],
                // Opus 4.8: adaptive thinking only (no budget_tokens / sampling
                // params). Thinking display defaults to "omitted" on Opus 4.8,
                // which streams empty thinking blocks — the UI would show a
                // long silent pause. "summarized" restores visible reasoning.
                thinking: { type: "adaptive", display: "summarized" },
                output_config: { effort: "high" },
            },
            { signal: request.signal },
        );

        const encoder = new TextEncoder();
        const runId = nextId();
        const messageId = nextId();
        let isInThinkingBlock = false;

        const readable = new ReadableStream({
            async start(controller) {
                const emit = (data: string) => controller.enqueue(encoder.encode(data));

                try {
                    emit(aguiEvent({ type: "RUN_STARTED", runId }));

                    stream.on("streamEvent", (event) => {
                        if (event.type === "content_block_start") {
                            const blockType = event.content_block?.type;
                            if (blockType === "thinking") {
                                isInThinkingBlock = true;
                                emit(
                                    aguiEvent({
                                        type: "STEP_STARTED",
                                        stepId: nextId(),
                                        stepType: "thinking",
                                    }),
                                );
                            } else if (blockType === "text") {
                                emit(
                                    aguiEvent({
                                        type: "TEXT_MESSAGE_START",
                                        messageId,
                                        role: "assistant",
                                    }),
                                );
                            }
                        }
                        if (event.type === "content_block_stop" && isInThinkingBlock) {
                            isInThinkingBlock = false;
                        }
                    });

                    stream.on("text", (textDelta) => {
                        emit(
                            aguiEvent({
                                type: "TEXT_MESSAGE_CONTENT",
                                messageId,
                                delta: textDelta,
                            }),
                        );
                    });

                    stream.on("thinking", (thinkingDelta) => {
                        emit(
                            aguiEvent({
                                type: "STEP_FINISHED",
                                stepId: nextId(),
                                delta: thinkingDelta,
                            }),
                        );
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

                    trackAIChat(analytics, {
                        format,
                        personality: "meta-analyst",
                        mode,
                        thinking: true,
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
                    console.error("Meta-report stream error:", err);
                    const errorMessage =
                        err instanceof Error ? err.message : "Unknown streaming error";
                    emit(aguiEvent({ type: "RUN_ERROR", runId, error: { message: errorMessage } }));
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
    } catch (error) {
        console.error("Meta-report streaming error:", error);
        return new Response(JSON.stringify({ error: "Failed to process meta-report request" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
