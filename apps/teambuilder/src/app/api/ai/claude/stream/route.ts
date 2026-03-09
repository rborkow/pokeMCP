import { type NextRequest, after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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
import { DEFAULT_PERSONALITY, type PersonalityId } from "@/lib/ai/personalities";
import { TEAM_TOOLS } from "@/lib/ai/tools";
import type { Mode } from "@/types/pokemon";

// Max number of previous messages to include for context (to manage token usage)
const MAX_HISTORY_MESSAGES = 10;

// Simple in-memory rate limiting (per-isolate, best-effort)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

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

// Periodically clean up expired entries to prevent memory leaks
function cleanupRateLimits() {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now > entry.resetAt) {
            rateLimitMap.delete(ip);
        }
    }
}

// Clean up every 5 minutes
setInterval(cleanupRateLimits, 5 * 60_000);

export async function POST(request: NextRequest) {
    // Rate limiting check
    const clientIp =
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";

    if (isRateLimited(clientIp)) {
        return new Response(
            JSON.stringify({
                error: "Too many requests. Please wait a minute before trying again.",
            }),
            {
                status: 429,
                headers: { "Content-Type": "application/json", "Retry-After": "60" },
            },
        );
    }

    try {
        const {
            message,
            team = [],
            format = "gen9ou",
            mode = "singles",
            enableThinking,
            personality: personalityId = DEFAULT_PERSONALITY,
            chatHistory = [],
        } = await request.json();

        if (!message) {
            return new Response(JSON.stringify({ error: "Message is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Claude API key not configured" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Fetch context in parallel
        // Only fetch teammate analysis if team has Pokemon (helps with suggestions)
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
        );

        // Only enable extended thinking when the client explicitly requests it
        const useThinking = enableThinking === true;

        // Build conversation messages with history
        // Take only the most recent messages to avoid token limits
        const recentHistory = (chatHistory as { role: string; content: string }[])
            .slice(-MAX_HISTORY_MESSAGES)
            .map((msg) => ({
                role: msg.role as "user" | "assistant",
                content: msg.content,
            }));

        // Build the messages array: history + current message with full context
        const messages = [...recentHistory, { role: "user" as const, content: fullUserMessage }];

        // Track response time from stream start
        const streamStartTime = performance.now();

        // Create Anthropic client and stream
        const client = new Anthropic({ apiKey });

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
                messages,
                tools: TEAM_TOOLS as Anthropic.Messages.Tool[],
                thinking: { type: "adaptive" },
                output_config: { effort: useThinking ? "high" : "medium" },
            },
            { signal: request.signal },
        );

        // Track tool use state for accumulating tool input
        let currentToolId = "";
        let currentToolName = "";
        let toolInputSnapshot: unknown = null;
        let isInThinkingBlock = false;
        let isInToolBlock = false;

        // Promise that resolves with usage data once the stream completes
        let resolveUsage: (data: {
            format: string;
            personality: string;
            mode: string;
            thinkingEnabled: boolean;
            teamSize: number;
            inputTokens: number;
            outputTokens: number;
            cacheCreationInputTokens: number;
            cacheReadInputTokens: number;
            responseTimeMs: number;
        }) => void;
        const usageReady = new Promise<{
            format: string;
            personality: string;
            mode: string;
            thinkingEnabled: boolean;
            teamSize: number;
            inputTokens: number;
            outputTokens: number;
            cacheCreationInputTokens: number;
            cacheReadInputTokens: number;
            responseTimeMs: number;
        }>((resolve) => {
            resolveUsage = resolve;
        });

        const encoder = new TextEncoder();

        const readable = new ReadableStream({
            async start(controller) {
                const emit = (data: unknown) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };

                try {
                    stream.on("streamEvent", (event) => {
                        // Track content block starts for phase events
                        if (event.type === "content_block_start") {
                            const blockType = event.content_block?.type;
                            if (blockType === "thinking") {
                                isInThinkingBlock = true;
                                emit({ phase: "thinking" });
                                emit({ thinking: true, text: "" });
                            } else if (blockType === "text") {
                                emit({ phase: "generating" });
                            } else if (blockType === "tool_use") {
                                isInToolBlock = true;
                                const block =
                                    event.content_block as Anthropic.Messages.ToolUseBlock;
                                currentToolId = block.id || "";
                                currentToolName = block.name || "";
                                toolInputSnapshot = null;
                                emit({ phase: "tool_calling" });
                            }
                        }

                        // Track content block stops
                        if (event.type === "content_block_stop") {
                            if (isInThinkingBlock) {
                                isInThinkingBlock = false;
                                emit({ thinking: false });
                            } else if (isInToolBlock) {
                                // Emit the complete tool call
                                if (currentToolName && toolInputSnapshot !== null) {
                                    emit({
                                        tool_use: {
                                            id: currentToolId,
                                            name: currentToolName,
                                            input: toolInputSnapshot,
                                        },
                                    });
                                }
                                isInToolBlock = false;
                                currentToolId = "";
                                currentToolName = "";
                                toolInputSnapshot = null;
                            }
                        }
                    });

                    // Text deltas
                    stream.on("text", (textDelta) => {
                        emit({ text: textDelta });
                    });

                    // Thinking deltas
                    stream.on("thinking", (thinkingDelta) => {
                        emit({ thinking: true, text: thinkingDelta });
                    });

                    // Tool input JSON — track the snapshot for emission at block stop
                    stream.on("inputJson", (_partialJson, jsonSnapshot) => {
                        toolInputSnapshot = jsonSnapshot;
                    });

                    // Wait for the stream to complete — the returned message has
                    // authoritative usage data (more reliable than event-based capture)
                    const finalMsg = await stream.finalMessage();

                    const usageData = {
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
                    };

                    console.log(
                        JSON.stringify({ type: "ai_usage", ...usageData, timestamp: Date.now() }),
                    );

                    // Resolve the usage promise so after() can send it to analytics
                    resolveUsage!(usageData);

                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                } catch (err) {
                    // Handle abort/cancellation
                    if (err instanceof Error && err.name === "AbortError") {
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                        controller.close();
                        return;
                    }

                    console.error("Stream error:", err);
                    const errorMessage =
                        err instanceof Error ? err.message : "Unknown streaming error";
                    emit({ error: errorMessage });
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                }
            },
            cancel() {
                stream.abort();
            },
        });

        // Schedule analytics tracking via after() — runs after the response is sent,
        // guaranteed to complete even if the isolate would otherwise shut down
        after(async () => {
            try {
                const usage = await usageReady;
                const mcpUrl = process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com";
                const trackResp = await fetch(`${mcpUrl}/admin/api/track-ai`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        format: usage.format,
                        personality: usage.personality,
                        mode: usage.mode,
                        thinking: usage.thinkingEnabled,
                        inputTokens: usage.inputTokens,
                        outputTokens: usage.outputTokens,
                        cacheCreationTokens: usage.cacheCreationInputTokens,
                        cacheReadTokens: usage.cacheReadInputTokens,
                        teamSize: usage.teamSize,
                        responseTimeMs: usage.responseTimeMs,
                        source: "web",
                    }),
                    signal: AbortSignal.timeout(5000),
                });
                console.log(`[Analytics] track-ai response: ${trackResp.status}`);
            } catch (err) {
                console.error("[Analytics] Failed to forward usage:", err);
            }
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
