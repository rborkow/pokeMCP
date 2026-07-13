import { z } from "zod";
import { enforceAiRateLimit } from "@/lib/ai/rate-limit";
import { callInternalTool } from "@/lib/internal-tools";

const pokemon = z.string().trim().min(1).max(80);
const format = z.string().trim().min(1).max(80).optional();
const limit = z.number().int().min(1).max(50).default(20);

const AnalysisRequestSchema = z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("pokemon"), pokemon, generation: z.string().max(20).optional() }),
    z.object({ operation: z.literal("moveset"), pokemon, moves: z.array(z.string().max(80)).max(4), generation: z.string().max(20).optional() }),
    z.object({ operation: z.literal("team"), team: z.array(z.unknown()).max(6), format }),
    z.object({ operation: z.literal("coverage"), currentTeam: z.array(pokemon).max(6), format }),
    z.object({ operation: z.literal("popular-sets"), pokemon, format }),
    z.object({ operation: z.literal("threats"), format, limit }),
    z.object({ operation: z.literal("teammates"), pokemon, format, limit }),
    z.object({ operation: z.literal("counters"), pokemon, format, limit }),
    z.object({ operation: z.literal("metagame"), format }),
    z.object({ operation: z.literal("strategy"), query: z.string().trim().min(1).max(500), format, limit: z.number().int().min(1).max(10).default(5) }),
]);

function internalRequest(input: z.infer<typeof AnalysisRequestSchema>): {
    tool: string;
    args: Record<string, unknown>;
} {
    switch (input.operation) {
        case "pokemon":
            return { tool: "lookup_pokemon", args: { pokemon: input.pokemon, generation: input.generation } };
        case "moveset":
            return { tool: "validate_moveset", args: { pokemon: input.pokemon, moves: input.moves, generation: input.generation } };
        case "team":
            return { tool: "validate_team", args: { team: input.team, format: input.format } };
        case "coverage":
            return { tool: "suggest_team_coverage", args: { current_team: input.currentTeam, format: input.format } };
        case "popular-sets":
            return { tool: "get_usage_stats", args: { type: "popular_sets", pokemon: input.pokemon, format: input.format } };
        case "threats":
            return { tool: "get_usage_stats", args: { type: "meta_threats", format: input.format, limit: input.limit } };
        case "teammates":
            return { tool: "get_usage_stats", args: { type: "teammates", pokemon: input.pokemon, format: input.format, limit: input.limit } };
        case "counters":
            return { tool: "get_usage_stats", args: { type: "checks_counters", pokemon: input.pokemon, format: input.format, limit: input.limit } };
        case "metagame":
            return { tool: "get_usage_stats", args: { type: "metagame", format: input.format } };
        case "strategy":
            return { tool: "query_strategy", args: { query: input.query, format: input.format, limit: input.limit } };
    }
}

export async function POST(request: Request) {
    const origin = request.headers.get("origin");
    if (process.env.NODE_ENV === "production" && origin && origin !== new URL(request.url).origin) {
        return Response.json({ error: "Same-origin product request required." }, { status: 403 });
    }
    if (Number(request.headers.get("content-length") ?? "0") > 96 * 1024) {
        return Response.json({ error: "Request too large." }, { status: 413 });
    }
    const limited = await enforceAiRateLimit(request, "analysis");
    if (limited) return limited;

    try {
        const parsed = AnalysisRequestSchema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid analysis request." }, { status: 400 });
        const { tool, args } = internalRequest(parsed.data);
        const data = await callInternalTool(tool, args);
        return Response.json({ data });
    } catch (error) {
        console.error(JSON.stringify({ event: "analysis_error", message: error instanceof Error ? error.message : "unknown" }));
        return Response.json({ error: "Analysis is temporarily unavailable." }, { status: 503 });
    }
}
