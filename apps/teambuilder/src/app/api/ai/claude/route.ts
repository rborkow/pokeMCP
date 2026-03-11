import { NextResponse } from "next/server";
import {
    buildSystemPrompt,
    buildUserMessage,
    fetchMetaThreats,
    fetchPopularSetsContext,
    formatTeamContext,
    type TeamPokemon,
} from "@/lib/ai/context";
import { DEFAULT_PERSONALITY, type PersonalityId } from "@/lib/ai/personalities";

export async function POST(request: Request) {
    try {
        const {
            message,
            team = [],
            format = "gen9ou",
            mode = "singles",
            personality: personalityId = DEFAULT_PERSONALITY,
        } = await request.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                {
                    error: "Claude API key not configured. Please use Cloudflare AI instead.",
                },
                { status: 503 },
            );
        }

        // Fetch context in parallel
        const [metaThreats, popularSetsContext] = await Promise.all([
            fetchMetaThreats(format),
            fetchPopularSetsContext(message, format),
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
        );

        const requestStart = performance.now();

        // Route through AI Gateway if configured (automatic cost/token tracking)
        const gatewayUrl = process.env.CLOUDFLARE_AI_GATEWAY_URL;
        const gatewayToken = process.env.CF_AIG_TOKEN;
        const apiUrl = gatewayUrl
            ? `${gatewayUrl}/v1/messages`
            : "https://api.anthropic.com/v1/messages";

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                ...(gatewayUrl && {
                    ...(gatewayToken && {
                        "cf-aig-authorization": `Bearer ${gatewayToken}`,
                    }),
                    "cf-aig-metadata": JSON.stringify({ source: "web" }),
                }),
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-6",
                max_tokens: 1024,
                output_config: { effort: "low" },
                system: [
                    {
                        type: "text",
                        text: systemPrompt,
                        cache_control: { type: "ephemeral" },
                    },
                ],
                messages: [{ role: "user", content: fullUserMessage }],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Claude API error:", response.status, errorText);
            let errorMessage = "Claude API request failed";
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error?.message || errorMessage;
            } catch {
                if (errorText) errorMessage = errorText;
            }
            return NextResponse.json({ error: errorMessage }, { status: response.status });
        }

        const data = await response.json();
        const content = data.content?.[0]?.text || "";
        const responseTimeMs = Math.round(performance.now() - requestStart);

        // Log usage for observability (AI Gateway tracks cost/tokens automatically)
        if (data.usage) {
            console.log(
                JSON.stringify({
                    type: "ai_usage",
                    format,
                    personality: personalityId,
                    mode,
                    teamSize: (team as TeamPokemon[]).length,
                    inputTokens: data.usage.input_tokens ?? 0,
                    outputTokens: data.usage.output_tokens ?? 0,
                    cacheCreationInputTokens: data.usage.cache_creation_input_tokens ?? 0,
                    cacheReadInputTokens: data.usage.cache_read_input_tokens ?? 0,
                    responseTimeMs,
                    timestamp: Date.now(),
                }),
            );
        }

        return NextResponse.json({ content });
    } catch (error) {
        console.error("Claude API error:", error);
        return NextResponse.json({ error: "Failed to process Claude request" }, { status: 500 });
    }
}
