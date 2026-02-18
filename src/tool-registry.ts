import { z } from "zod";
import { queryStrategy, queryStrategyText } from "./rag/query.js";
import {
    getChecksCounters,
    getMetagameStats,
    getMetaThreats,
    getPopularSets,
    getTeammates,
} from "./stats.js";
import { lookupPokemon, suggestTeamCoverage, validateMoveset, validateTeam } from "./tools.js";

/**
 * Definition for a single MCP tool in the registry.
 */
export interface ToolDefinition {
    name: string;
    description: string;
    schema: Record<string, z.ZodTypeAny>;
    execute: (args: Record<string, unknown>, env: Env) => Promise<string>;
}

/**
 * Central registry of all MCP tools.
 * Used by both the MCP server init() and the /api/tools REST endpoint.
 */
export const TOOL_REGISTRY: ToolDefinition[] = [
    // --- Sync tools (bundled Pokemon Showdown data, no env needed) ---
    {
        name: "lookup_pokemon",
        description:
            "Look up detailed information about a Pokémon including stats, types, abilities, and available moves",
        schema: {
            pokemon: z
                .string()
                .describe("The name of the Pokémon to look up (e.g., 'Pikachu', 'Charizard')"),
            generation: z
                .string()
                .optional()
                .describe("Optional: Game generation to check (e.g., '9' for Gen 9)"),
        },
        execute: async (args) => lookupPokemon(args as { pokemon: string; generation?: string }),
    },
    {
        name: "validate_moveset",
        description:
            "Check if a moveset is legal for a specific Pokémon in a given generation/format",
        schema: {
            pokemon: z.string().describe("The Pokémon name"),
            moves: z.array(z.string()).describe("Array of move names to validate"),
            generation: z.string().optional().describe("Game generation (e.g., '9')"),
        },
        execute: async (args) =>
            validateMoveset(args as { pokemon: string; moves: string[]; generation?: string }),
    },
    {
        name: "validate_team",
        description:
            "Validate a team of Pokémon against format rules (Species Clause, move legality, tier restrictions)",
        schema: {
            team: z
                .array(
                    z.object({
                        pokemon: z.string(),
                        moves: z.array(z.string()),
                        ability: z.string().optional(),
                        item: z.string().optional(),
                    }),
                )
                .describe("Array of team members with their movesets"),
            format: z
                .string()
                .optional()
                .describe("Format to validate against (e.g., 'OU', 'Ubers')"),
        },
        execute: async (args) => validateTeam(args as { team: any[]; format?: string }),
    },
    {
        name: "suggest_team_coverage",
        description:
            "Analyze a partial team and suggest Pokémon to improve type coverage and handle threats",
        schema: {
            current_team: z
                .array(z.string())
                .describe("Array of Pokémon names currently on the team"),
            format: z.string().optional().describe("Format for suggestions (e.g., 'OU')"),
        },
        execute: async (args) =>
            suggestTeamCoverage(args as { current_team: string[]; format?: string }),
    },

    // --- Async tools (Cloudflare KV stats, need env) ---
    {
        name: "get_popular_sets",
        description:
            "Get the most popular competitive sets for a Pokémon from Smogon usage statistics (moves, items, abilities, spreads)",
        schema: {
            pokemon: z.string().describe("The Pokémon name"),
            format: z
                .string()
                .optional()
                .describe("Format to check (e.g., 'gen9ou', 'gen9vgc2024')"),
        },
        execute: async (args, env) =>
            getPopularSets(args as { pokemon: string; format?: string }, env),
    },
    {
        name: "get_meta_threats",
        description: "Get the top threats in the metagame by usage percentage",
        schema: {
            format: z.string().optional().describe("Format to check (e.g., 'gen9ou', 'gen9ubers')"),
            limit: z.number().optional().describe("Number of top Pokémon to show"),
        },
        execute: async (args, env) =>
            getMetaThreats(args as { format?: string; limit?: number }, env),
    },
    {
        name: "get_teammates",
        description:
            "Get common teammates for a Pokémon based on actual team compositions from competitive play",
        schema: {
            pokemon: z.string().describe("The Pokémon name"),
            format: z.string().optional().describe("Format to check (e.g., 'gen9ou')"),
            limit: z.number().optional().describe("Number of teammates to show"),
        },
        execute: async (args, env) =>
            getTeammates(args as { pokemon: string; format?: string; limit?: number }, env),
    },
    {
        name: "get_checks_counters",
        description:
            "Get the most effective checks and counters for a Pokémon based on battle statistics",
        schema: {
            pokemon: z.string().describe("The Pokémon name"),
            format: z.string().optional().describe("Format to check (e.g., 'gen9ou')"),
            limit: z.number().optional().describe("Number of checks/counters to show"),
        },
        execute: async (args, env) =>
            getChecksCounters(args as { pokemon: string; format?: string; limit?: number }, env),
    },
    {
        name: "get_metagame_stats",
        description:
            "Get overall metagame statistics including playstyle distribution and unique Pokémon count",
        schema: {
            format: z.string().optional().describe("Format to check (e.g., 'gen9ou')"),
        },
        execute: async (args, env) => getMetagameStats(args as { format?: string }, env),
    },

    // --- RAG tools (Cloudflare Vectorize + KV, need env) ---
    {
        name: "query_strategy",
        description: "Natural language search over Smogon strategic content for competitive advice",
        schema: {
            query: z
                .string()
                .describe(
                    "Natural language question about competitive strategy (e.g., 'How do I counter Garchomp?', 'What are Landorus-T's best sets?')",
                ),
            format: z
                .string()
                .optional()
                .describe("Optional: Filter by format (e.g., 'gen9ou', 'gen9vgc2024regf')"),
            limit: z
                .number()
                .optional()
                .describe("Optional: Number of results to return (default: 5)"),
        },
        execute: async (args, env) => {
            const result = await queryStrategy(
                args as { query: string; format?: string; limit?: number },
                env,
            );
            return typeof result === "string" ? result : JSON.stringify(result);
        },
    },
    {
        name: "search_strategic_content",
        description:
            "Search strategic content with detailed filters by Pokémon, format, and section type",
        schema: {
            query: z.string().describe("Search query for strategic content"),
            pokemon: z
                .string()
                .optional()
                .describe(
                    "Optional: Filter by specific Pokémon (e.g., 'garchomp', 'landorus-therian')",
                ),
            format: z
                .string()
                .optional()
                .describe("Optional: Filter by format (e.g., 'gen9ou', 'gen9ubers')"),
            sectionType: z
                .enum(["overview", "moveset", "counters", "teammates"])
                .optional()
                .describe("Optional: Filter by section type"),
            limit: z
                .number()
                .optional()
                .describe("Optional: Number of results to return (default: 5)"),
        },
        execute: async (args, env) => {
            const result = await queryStrategyText(
                args as {
                    query: string;
                    pokemon?: string;
                    format?: string;
                    sectionType?: "overview" | "moveset" | "counters" | "teammates";
                    limit?: number;
                },
                env,
            );
            return typeof result === "string" ? result : JSON.stringify(result);
        },
    },
];
