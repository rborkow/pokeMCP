import { chat, toServerSentEventsResponse, maxIterations } from "@tanstack/ai";
import { anthropicText } from "@tanstack/ai-anthropic";
import type { ChatMiddleware } from "@tanstack/ai";
import type { NextRequest } from "next/server";
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
import { modifyTeamTool } from "@/lib/ai/tools-tanstack";
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

        // Fetch context in parallel (same as before)
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

        const useThinking = enableThinking === true;

        // Build conversation messages with history
        const recentHistory = (chatHistory as { role: string; content: string }[])
            .slice(-MAX_HISTORY_MESSAGES)
            .map((msg) => ({
                role: msg.role as "user" | "assistant",
                content: msg.content,
            }));

        const messages = [...recentHistory, { role: "user" as const, content: fullUserMessage }];

        // Track response time
        const streamStartTime = performance.now();

        // Create adapter — route through AI Gateway if configured
        const gatewayUrl = process.env.CLOUDFLARE_AI_GATEWAY_URL;
        const gatewayToken = process.env.CF_AIG_TOKEN;
        const adapter = anthropicText("claude-sonnet-4-6", {
            apiKey,
            ...(gatewayUrl && {
                baseURL: gatewayUrl,
                defaultHeaders: {
                    ...(gatewayToken && {
                        "cf-aig-authorization": `Bearer ${gatewayToken}`,
                    }),
                    "cf-aig-metadata": JSON.stringify({ source: "web" }),
                },
            }),
        });

        // Logging middleware — replaces the manual console.log in the old route
        const loggingMiddleware: ChatMiddleware = {
            name: "usage-logging",
            onUsage(_ctx, usage) {
                console.log(
                    JSON.stringify({
                        type: "ai_usage",
                        format,
                        personality: personalityId,
                        mode,
                        thinkingEnabled: useThinking,
                        teamSize: (team as TeamPokemon[]).length,
                        inputTokens: usage.promptTokens,
                        outputTokens: usage.completionTokens,
                        responseTimeMs: Math.round(performance.now() - streamStartTime),
                        timestamp: Date.now(),
                    }),
                );
            },
        };

        // Create the streaming response via TanStack AI
        const stream = chat({
            adapter,
            messages,
            tools: [modifyTeamTool],
            maxTokens: 16000,
            // Use modelOptions for Anthropic-specific features:
            // - system with cache_control for prompt caching
            // - thinking mode configuration
            // modelOptions uses Anthropic-specific fields.
            // `effort` is a valid runtime option but missing from the per-model
            // type in @tanstack/ai-anthropic (alpha type gap — validKeys includes it).
            modelOptions: {
                system: [
                    {
                        type: "text" as const,
                        text: systemPrompt,
                        cache_control: { type: "ephemeral" as const },
                    },
                ],
                ...(useThinking && { thinking: { type: "adaptive" as const } }),
                effort: (useThinking ? "high" : "low") as "high" | "low",
            } as typeof adapter extends { "~types": { providerOptions: infer P } } ? P : never,
            // Stop after first iteration — tool calls are handled client-side
            agentLoopStrategy: maxIterations(1),
            abortController: request.signal
                ? { signal: request.signal, abort: () => {} }
                : undefined,
            middleware: [loggingMiddleware],
        });

        return toServerSentEventsResponse(stream);
    } catch (error) {
        console.error("Claude streaming error:", error);
        return new Response(JSON.stringify({ error: "Failed to process Claude request" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
