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
        description: "Look up Pokémon stats, types, abilities, and moves",
        schema: {
            pokemon: z.string().describe("Pokémon name"),
            generation: z.string().optional().describe("Generation number (e.g., '9')"),
        },
        execute: async (args) => lookupPokemon(args as { pokemon: string; generation?: string }),
    },
    {
        name: "validate_moveset",
        description: "Check if a moveset is legal for a Pokémon",
        schema: {
            pokemon: z.string().describe("Pokémon name"),
            moves: z.array(z.string()).describe("Move names to validate"),
            generation: z.string().optional().describe("Generation number (e.g., '9')"),
        },
        execute: async (args) =>
            validateMoveset(args as { pokemon: string; moves: string[]; generation?: string }),
    },
    {
        name: "validate_team",
        description: "Validate a team against format rules",
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
                .describe("Team members with movesets"),
            format: z.string().optional().describe("Format ID (e.g., 'gen9ou')"),
        },
        execute: async (args) => validateTeam(args as { team: any[]; format?: string }),
    },
    {
        name: "suggest_team_coverage",
        description: "Suggest Pokémon to improve team type coverage",
        schema: {
            current_team: z.array(z.string()).describe("Pokémon names on the team"),
            format: z.string().optional().describe("Format ID (e.g., 'gen9ou')"),
        },
        execute: async (args) =>
            suggestTeamCoverage(args as { current_team: string[]; format?: string }),
    },

    // --- Unified stats tool (Cloudflare KV, needs env) ---
    {
        name: "get_usage_stats",
        description: "Get Smogon competitive usage statistics",
        schema: {
            type: z
                .enum(["popular_sets", "meta_threats", "teammates", "checks_counters", "metagame"])
                .describe("Stat type"),
            pokemon: z.string().optional().describe("Pokémon name"),
            format: z.string().optional().describe("Format ID (e.g., 'gen9ou')"),
            limit: z.number().optional().describe("Max results"),
        },
        execute: async (args, env) => {
            const { type, pokemon, format, limit } = args as {
                type: string;
                pokemon?: string;
                format?: string;
                limit?: number;
            };
            switch (type) {
                case "popular_sets":
                    return getPopularSets({ pokemon: pokemon || "", format }, env);
                case "meta_threats":
                    return getMetaThreats({ format, limit }, env);
                case "teammates":
                    return getTeammates({ pokemon: pokemon || "", format, limit }, env);
                case "checks_counters":
                    return getChecksCounters({ pokemon: pokemon || "", format, limit }, env);
                case "metagame":
                    return getMetagameStats({ format }, env);
                default:
                    return `Unknown stat type: ${type}`;
            }
        },
    },

    // --- Unified RAG tool (Cloudflare Vectorize + KV, needs env) ---
    {
        name: "query_strategy",
        description: "Search Smogon strategy guides with optional filters",
        schema: {
            query: z.string().describe("Strategy question"),
            pokemon: z.string().optional().describe("Pokémon name filter"),
            format: z.string().optional().describe("Format ID (e.g., 'gen9ou')"),
            sectionType: z
                .enum(["overview", "moveset", "counters", "teammates"])
                .optional()
                .describe("Section type filter"),
            limit: z.number().optional().describe("Max results"),
        },
        execute: async (args, env) => {
            const options = args as {
                query: string;
                pokemon?: string;
                format?: string;
                sectionType?: "overview" | "moveset" | "counters" | "teammates";
                limit?: number;
            };
            // Use text format when filters are provided (more structured), JSON otherwise
            if (options.pokemon || options.sectionType) {
                const result = await queryStrategyText(options, env);
                return typeof result === "string" ? result : JSON.stringify(result);
            }
            const result = await queryStrategy(options, env);
            return typeof result === "string" ? result : JSON.stringify(result);
        },
    },
];
