import type Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { getAnalyticsBinding, trackAIChat } from "@/lib/ai/analytics";
import { createAnthropicClient } from "@/lib/ai/anthropic-client";
import {
    buildSystemPrompt,
    buildUserMessage,
    fetchMetaThreats,
    fetchPopularSetsContext,
    fetchStrategyContext,
    fetchTeammateAnalysis,
    formatTeamContext,
    type TeamPokemon,
} from "@/lib/ai/context";
import { logGatewayHealthOnce } from "@/lib/ai/gateway-health";
import type { PersonalityId } from "@/lib/ai/personalities";
import { TEAM_TOOLS } from "@/lib/ai/tools";
import { checkOrigin, checkRateLimit, readJsonBody, validationError } from "@/lib/api/ai-guard";
import { ChatRequestSchema, toUserFirst } from "@/lib/api/ai-schemas";
import type { Mode } from "@/types/pokemon";

// Max number of previous messages to include for context (to manage token usage)
const MAX_HISTORY_MESSAGES = 10;

// Per-IP rate limit: 20 requests per minute (shared guard, CF binding-backed).
const RATE_LIMIT = { route: "chat", limit: 20, bindingName: "AI_RATE_LIMITER_CHAT" };

/**
 * AG-UI event emitter helpers.
 *
 * The server emits events in the AG-UI protocol format (used by TanStack AI)
 * so the client parser is unified regardless of what drives the stream.
 */
let eventCounter = 0;
function nextId(): string {
    return `evt_${++eventCounter}_${Date.now()}`;
}

function aguiEvent(data: Record<string, unknown>): string {
    return `data: ${JSON.stringify({ timestamp: Date.now(), ...data })}\n\n`;
}

export async function POST(request: NextRequest) {
    logGatewayHealthOnce("claude-stream");

    const originError = checkOrigin(request);
    if (originError) return originError;

    const rateLimitError = await checkRateLimit(request, RATE_LIMIT);
    if (rateLimitError) return rateLimitError;

    try {
        const body = await readJsonBody(request);
        if (!body.ok) return body.response;

        const parsed = ChatRequestSchema.safeParse(body.data);
        if (!parsed.success) {
            return validationError();
        }

        const {
            message,
            team,
            format,
            mode,
            enableThinking,
            personality: personalityId,
            chatHistory,
            recentEdits,
        } = parsed.data;

        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Claude API key not configured" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Fetch context in parallel
        const [metaThreats, popularSetsContext, teammateAnalysis, strategyContext] =
            await Promise.all([
                fetchMetaThreats(format),
                fetchPopularSetsContext(message, format),
                team.length > 0 && team.length < 6
                    ? fetchTeammateAnalysis(team as TeamPokemon[], format)
                    : Promise.resolve(""),
                fetchStrategyContext(message, format),
            ]);

        // Build prompts
        const teamContext = formatTeamContext(team as TeamPokemon[]);
        const systemPrompt = buildSystemPrompt(
            personalityId as PersonalityId,
            format,
            team.length,
            mode,
        );
        const fullUserMessage = buildUserMessage(
            teamContext,
            metaThreats,
            popularSetsContext,
            message,
            format,
            team as TeamPokemon[],
            mode as Mode,
            teammateAnalysis,
            strategyContext,
            recentEdits as { text: string; slot: number; createdAt: number }[],
        );

        const useThinking = enableThinking === true;

        // Build conversation messages with history. After slicing to the last
        // N messages, drop leading entries until the first "user" turn —
        // slice(-N) can produce an assistant-first array, which the Anthropic
        // API rejects with a 400 on long conversations.
        const recentHistory = toUserFirst(chatHistory.slice(-MAX_HISTORY_MESSAGES));

        const messages = [...recentHistory, { role: "user" as const, content: fullUserMessage }];

        const streamStartTime = performance.now();

        // Capture the Analytics Engine binding in request context — the stream
        // body is pulled after this handler returns, so we can't resolve the
        // Cloudflare context from inside the stream callback.
        const analytics = getAnalyticsBinding();

        const client = createAnthropicClient("web");

        const stream = client.messages.stream(
            {
                model: "claude-sonnet-4-6",
                max_tokens: 4096,
                system: [
                    {
                        type: "text",
                        text: systemPrompt,
                        cache_control: { type: "ephemeral" },
                    },
                ],
                messages,
                tools: TEAM_TOOLS as Anthropic.Messages.Tool[],
                ...(useThinking && { thinking: { type: "adaptive" } }),
                output_config: { effort: useThinking ? "high" : "low" },
            },
            { signal: request.signal },
        );

        // Track tool use state for accumulating tool input
        let currentToolId = "";
        let currentToolName = "";
        let toolInputSnapshot: unknown = null;
        let isInThinkingBlock = false;
        let isInToolBlock = false;

        const encoder = new TextEncoder();
        const runId = nextId();
        const messageId = nextId();

        const readable = new ReadableStream({
            async start(controller) {
                const emit = (data: string) => {
                    controller.enqueue(encoder.encode(data));
                };

                try {
                    // Emit RUN_STARTED
                    emit(aguiEvent({ type: "RUN_STARTED", runId }));

                    stream.on("streamEvent", (event) => {
                        if (event.type === "content_block_start") {
                            const blockType = event.content_block?.type;
                            if (blockType === "thinking") {
                                isInThinkingBlock = true;
                                const stepId = nextId();
                                emit(
                                    aguiEvent({
                                        type: "STEP_STARTED",
                                        stepId,
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
                            } else if (blockType === "tool_use") {
                                isInToolBlock = true;
                                const block =
                                    event.content_block as Anthropic.Messages.ToolUseBlock;
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
                            if (isInThinkingBlock) {
                                isInThinkingBlock = false;
                            } else if (isInToolBlock) {
                                // Emit complete tool call
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

                    // Text deltas → AG-UI TEXT_MESSAGE_CONTENT
                    stream.on("text", (textDelta) => {
                        emit(
                            aguiEvent({
                                type: "TEXT_MESSAGE_CONTENT",
                                messageId,
                                delta: textDelta,
                            }),
                        );
                    });

                    // Thinking deltas → AG-UI STEP_FINISHED with delta
                    stream.on("thinking", (thinkingDelta) => {
                        emit(
                            aguiEvent({
                                type: "STEP_FINISHED",
                                stepId: nextId(),
                                delta: thinkingDelta,
                            }),
                        );
                    });

                    // Tool input JSON
                    stream.on("inputJson", (_partialJson, jsonSnapshot) => {
                        toolInputSnapshot = jsonSnapshot;
                    });

                    const finalMsg = await stream.finalMessage();

                    // Emit TEXT_MESSAGE_END
                    emit(aguiEvent({ type: "TEXT_MESSAGE_END", messageId }));

                    // Emit RUN_FINISHED with usage
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
                            type: "ai_usage",
                            format,
                            personality: personalityId,
                            mode,
                            thinkingEnabled: useThinking,
                            teamSize: (team as TeamPokemon[]).length,
                            inputTokens: finalMsg.usage.input_tokens ?? 0,
                            outputTokens: finalMsg.usage.output_tokens ?? 0,
                            cacheCreationInputTokens:
                                finalMsg.usage.cache_creation_input_tokens ?? 0,
                            cacheReadInputTokens: finalMsg.usage.cache_read_input_tokens ?? 0,
                            responseTimeMs: Math.round(performance.now() - streamStartTime),
                            timestamp: Date.now(),
                        }),
                    );

                    trackAIChat(analytics, {
                        format,
                        personality: String(personalityId),
                        mode,
                        thinking: useThinking,
                        inputTokens: finalMsg.usage.input_tokens ?? 0,
                        outputTokens: finalMsg.usage.output_tokens ?? 0,
                        cacheCreationTokens: finalMsg.usage.cache_creation_input_tokens ?? 0,
                        cacheReadTokens: finalMsg.usage.cache_read_input_tokens ?? 0,
                        teamSize: (team as TeamPokemon[]).length,
                        responseTimeMs: Math.round(performance.now() - streamStartTime),
                        source: "web",
                    });

                    controller.close();
                } catch (err) {
                    if (err instanceof Error && err.name === "AbortError") {
                        emit(
                            aguiEvent({
                                type: "RUN_FINISHED",
                                runId,
                                finishReason: "stop",
                            }),
                        );
                        controller.close();
                        return;
                    }

                    console.error("Stream error:", err);
                    const errorMessage =
                        err instanceof Error ? err.message : "Unknown streaming error";
                    emit(
                        aguiEvent({
                            type: "RUN_ERROR",
                            runId,
                            error: { message: errorMessage },
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
    } catch (error) {
        console.error("Claude streaming error:", error);
        return new Response(JSON.stringify({ error: "Failed to process Claude request" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
