import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAnalyticsBinding, trackAIChat } from "@/lib/ai/analytics";
import { createAnthropicClient } from "@/lib/ai/anthropic-client";
import {
    MAX_COACH_HISTORY_MESSAGES,
    MAX_COACH_MESSAGE_CHARS,
    PrepPlanSchema,
} from "@/lib/prep/schema";

interface PrepEnv {
    PREP_RATE_LIMITER?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
}

const CoachRequestSchema = z.object({
    plan: PrepPlanSchema,
    question: z.string().trim().min(1).max(MAX_COACH_MESSAGE_CHARS),
    history: z
        .array(
            z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().min(1).max(MAX_COACH_MESSAGE_CHARS),
            }),
        )
        .max(MAX_COACH_HISTORY_MESSAGES)
        .default([]),
});

export async function POST(request: NextRequest) {
    if (Number(request.headers.get("content-length") ?? "0") > 128 * 1024) {
        return Response.json({ error: "Coach request is too large." }, { status: 413 });
    }
    try {
        const env = getCloudflareContext().env as PrepEnv;
        const key = request.headers.get("x-prep-workspace") ?? "anonymous";
        if (env.PREP_RATE_LIMITER) {
            const { success } = await env.PREP_RATE_LIMITER.limit({ key: `coach:${key}` });
            if (!success) {
                return Response.json(
                    { error: "Too many coach requests. Wait a minute and try again." },
                    { status: 429, headers: { "Retry-After": "60" } },
                );
            }
        }
    } catch {
        // Bindings are unavailable in next dev.
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Request body must be JSON." }, { status: 400 });
    }
    const parsed = CoachRequestSchema.safeParse(body);
    if (!parsed.success) {
        return Response.json({ error: "Invalid plan or coach question." }, { status: 400 });
    }

    const { plan, question, history } = parsed.data;
    const analytics = getAnalyticsBinding();
    const startTime = performance.now();
    try {
        const client = createAnthropicClient("prep");
        const message = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 1_200,
            system: `You are the plan-specific coach inside PokeMCP Prep. You may discuss only the supplied Champions matchup plan and its two team sheets.

Rules:
- Treat tournament-source evidence as factual only to the detail supplied.
- Treat calculated recommendations as heuristics, not outcomes.
- Never invent win rates, exact damage ranges, VP spreads, or speed order.
- Point out when Champions beta mechanics make an answer uncertain.
- Be concise and practical: normally 2-5 short paragraphs or a short list.
- Do not modify the saved plan. Explain a suggested revision and let the user choose whether to apply it.

MATCHUP PLAN JSON:
${JSON.stringify(plan)}`,
            messages: [
                ...history.slice(-MAX_COACH_HISTORY_MESSAGES),
                { role: "user" as const, content: question },
            ],
        });
        const answer = message.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n")
            .trim();
        trackAIChat(analytics, {
            format: plan.format,
            personality: "prep-coach",
            mode: "vgc",
            thinking: false,
            inputTokens: message.usage.input_tokens ?? 0,
            outputTokens: message.usage.output_tokens ?? 0,
            cacheCreationTokens: message.usage.cache_creation_input_tokens ?? 0,
            cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
            teamSize: plan.ownTeam.pokemon.length,
            responseTimeMs: Math.round(performance.now() - startTime),
            source: "prep",
        });
        return Response.json({ answer });
    } catch (error) {
        console.error(
            JSON.stringify({
                event: "prep_coach_error",
                message: error instanceof Error ? error.message : "unknown",
            }),
        );
        return Response.json(
            {
                error: "The matchup coach is unavailable right now. Your saved battle card is unaffected.",
            },
            { status: 503 },
        );
    }
}
