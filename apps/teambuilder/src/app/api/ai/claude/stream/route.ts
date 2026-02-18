import type { NextRequest } from "next/server";
import {
    buildSystemPrompt,
    buildUserMessage,
    fetchMetaThreats,
    fetchPopularSetsContext,
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
        const [metaThreats, popularSetsContext, teammateAnalysis] = await Promise.all([
            fetchMetaThreats(format),
            fetchPopularSetsContext(message, format),
            team.length > 0 && team.length < 6
                ? fetchTeammateAnalysis(team as TeamPokemon[], format)
                : Promise.resolve(""),
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

        // Build request body with tools and prompt caching
        const requestBody: Record<string, unknown> = {
            model: "claude-sonnet-4-5-20250929",
            max_tokens: useThinking ? 16000 : 4096,
            stream: true,
            // Use structured system message with cache_control for prompt caching
            system: [
                {
                    type: "text",
                    text: systemPrompt,
                    cache_control: { type: "ephemeral" },
                },
            ],
            messages,
            tools: TEAM_TOOLS,
        };

        // Add thinking configuration if enabled
        if (useThinking) {
            requestBody.thinking = {
                type: "enabled",
                budget_tokens: 4000,
            };
        }

        // Make streaming request to Claude with prompt caching enabled
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "prompt-caching-2024-07-31",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Claude API error:", response.status, errorText);
            return new Response(JSON.stringify({ error: "Claude API request failed" }), {
                status: response.status,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Transform the Claude stream to a simpler format
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let isThinking = false;
        let isToolUse = false;
        let currentToolName = "";
        let currentToolId = "";
        let toolInputBuffer = "";
        let buffer = "";

        // Usage logging: capture token counts from the stream
        const usageLog = {
            format,
            personality: personalityId,
            mode,
            teamSize: (team as TeamPokemon[]).length,
            thinkingEnabled: useThinking,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
        };

        const transformStream = new TransformStream({
            async transform(chunk, controller) {
                buffer += decoder.decode(chunk, { stream: true });

                const events = buffer.split("\n\n");
                buffer = events.pop() || "";

                for (const event of events) {
                    const lines = event.split("\n");
                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
                            if (data === "[DONE]") {
                                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                                continue;
                            }

                            try {
                                const parsed = JSON.parse(data);

                                // Capture usage data from message_start
                                if (parsed.type === "message_start" && parsed.message?.usage) {
                                    usageLog.inputTokens = parsed.message.usage.input_tokens ?? 0;
                                    usageLog.cacheCreationInputTokens =
                                        parsed.message.usage.cache_creation_input_tokens ?? 0;
                                    usageLog.cacheReadInputTokens =
                                        parsed.message.usage.cache_read_input_tokens ?? 0;
                                }

                                // Capture final usage data from message_delta
                                if (parsed.type === "message_delta" && parsed.usage) {
                                    usageLog.outputTokens = parsed.usage.output_tokens ?? 0;
                                }

                                if (parsed.type === "content_block_start") {
                                    const blockType = parsed.content_block?.type;

                                    if (blockType === "thinking") {
                                        isThinking = true;
                                        controller.enqueue(
                                            encoder.encode(
                                                `data: ${JSON.stringify({ thinking: true, text: "" })}\n\n`,
                                            ),
                                        );
                                    } else if (blockType === "tool_use") {
                                        isToolUse = true;
                                        currentToolName = parsed.content_block?.name || "";
                                        currentToolId = parsed.content_block?.id || "";
                                        toolInputBuffer = "";
                                    }
                                }

                                if (parsed.type === "content_block_delta") {
                                    if (parsed.delta?.thinking) {
                                        controller.enqueue(
                                            encoder.encode(
                                                `data: ${JSON.stringify({ thinking: true, text: parsed.delta.thinking })}\n\n`,
                                            ),
                                        );
                                    } else if (parsed.delta?.text) {
                                        controller.enqueue(
                                            encoder.encode(
                                                `data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`,
                                            ),
                                        );
                                    } else if (parsed.delta?.partial_json && isToolUse) {
                                        // Accumulate tool input JSON
                                        toolInputBuffer += parsed.delta.partial_json;
                                    }
                                }

                                if (parsed.type === "content_block_stop") {
                                    if (isThinking) {
                                        isThinking = false;
                                        controller.enqueue(
                                            encoder.encode(
                                                `data: ${JSON.stringify({ thinking: false })}\n\n`,
                                            ),
                                        );
                                    } else if (isToolUse) {
                                        // Parse the complete tool input and emit as tool_use event
                                        try {
                                            const toolInput = JSON.parse(toolInputBuffer);
                                            controller.enqueue(
                                                encoder.encode(
                                                    `data: ${JSON.stringify({
                                                        tool_use: {
                                                            id: currentToolId,
                                                            name: currentToolName,
                                                            input: toolInput,
                                                        },
                                                    })}\n\n`,
                                                ),
                                            );
                                        } catch (e) {
                                            console.error(
                                                "Failed to parse tool input:",
                                                e,
                                                toolInputBuffer,
                                            );
                                        }
                                        isToolUse = false;
                                        currentToolName = "";
                                        currentToolId = "";
                                        toolInputBuffer = "";
                                    }
                                }

                                if (parsed.type === "message_stop") {
                                    // Log usage data for observability (captured by Cloudflare Logs)
                                    console.log(
                                        JSON.stringify({
                                            type: "ai_usage",
                                            ...usageLog,
                                            timestamp: Date.now(),
                                        }),
                                    );
                                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                                }
                            } catch {
                                // Skip invalid JSON
                            }
                        }
                    }
                }
            },
            flush(controller) {
                if (buffer.trim()) {
                    const lines = buffer.split("\n");
                    for (const line of lines) {
                        if (line.startsWith("data: ") && line.slice(6) !== "[DONE]") {
                            try {
                                const parsed = JSON.parse(line.slice(6));
                                if (parsed.delta?.text) {
                                    controller.enqueue(
                                        encoder.encode(
                                            `data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`,
                                        ),
                                    );
                                }
                            } catch {
                                // Skip
                            }
                        }
                    }
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            },
        });

        return new Response(response.body?.pipeThrough(transformStream), {
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
