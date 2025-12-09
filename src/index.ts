import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import {
	lookupPokemon,
	validateMoveset,
	validateTeam,
	suggestTeamCoverage,
} from "./tools.js";
import {
	getPopularSets,
	getMetaThreats,
	getTeammates,
	getChecksCounters,
	getMetagameStats,
} from "./stats.js";

// Define our Pokemon MCP agent with tools
export class PokemonMCP extends McpAgent {
	server = new McpServer({
		name: "Pokemon MCP Server",
		version: "0.2.0",
	});

	async init() {
		// Lookup Pokemon tool
		this.server.tool(
			"lookup_pokemon",
			{
				pokemon: z.string().describe("The name of the Pokémon to look up (e.g., 'Pikachu', 'Charizard')"),
				generation: z.string().optional().describe("Optional: Game generation to check (e.g., '9' for Gen 9)"),
			},
			async ({ pokemon, generation }) => ({
				content: [{ type: "text", text: lookupPokemon({ pokemon, generation }) }],
			}),
		);

		// Validate moveset tool
		this.server.tool(
			"validate_moveset",
			{
				pokemon: z.string().describe("The Pokémon name"),
				moves: z.array(z.string()).describe("Array of move names to validate"),
				generation: z.string().optional().describe("Game generation (e.g., '9')"),
			},
			async ({ pokemon, moves, generation }) => ({
				content: [{ type: "text", text: validateMoveset({ pokemon, moves, generation }) }],
			}),
		);

		// Validate team tool
		this.server.tool(
			"validate_team",
			{
				team: z.array(
					z.object({
						pokemon: z.string(),
						moves: z.array(z.string()),
						ability: z.string().optional(),
						item: z.string().optional(),
					}),
				).describe("Array of team members with their movesets"),
				format: z.string().optional().describe("Format to validate against (e.g., 'OU', 'Ubers')"),
			},
			async ({ team, format }) => ({
				content: [{ type: "text", text: validateTeam({ team, format }) }],
			}),
		);

		// Suggest team coverage tool
		this.server.tool(
			"suggest_team_coverage",
			{
				current_team: z.array(z.string()).describe("Array of Pokémon names currently on the team"),
				format: z.string().optional().describe("Format for suggestions (e.g., 'OU')"),
			},
			async ({ current_team, format }) => ({
				content: [{ type: "text", text: suggestTeamCoverage({ current_team, format }) }],
			}),
		);

		// Get popular sets tool
		this.server.tool(
			"get_popular_sets",
			{
				pokemon: z.string().describe("The Pokémon name"),
				format: z.string().optional().describe("Format to check (e.g., 'gen9ou', 'gen9vgc2024')"),
			},
			async ({ pokemon, format }) => ({
				content: [{ type: "text", text: await getPopularSets({ pokemon, format }, this.env) }],
			}),
		);

		// Get meta threats tool
		this.server.tool(
			"get_meta_threats",
			{
				format: z.string().optional().describe("Format to check (e.g., 'gen9ou', 'gen9ubers')"),
				limit: z.number().optional().describe("Number of top Pokémon to show"),
			},
			async ({ format, limit }) => ({
				content: [{ type: "text", text: await getMetaThreats({ format, limit }, this.env) }],
			}),
		);

		// Get teammates tool
		this.server.tool(
			"get_teammates",
			{
				pokemon: z.string().describe("The Pokémon name"),
				format: z.string().optional().describe("Format to check (e.g., 'gen9ou')"),
				limit: z.number().optional().describe("Number of teammates to show"),
			},
			async ({ pokemon, format, limit }) => ({
				content: [{ type: "text", text: await getTeammates({ pokemon, format, limit }, this.env) }],
			}),
		);

		// Get checks and counters tool
		this.server.tool(
			"get_checks_counters",
			{
				pokemon: z.string().describe("The Pokémon name"),
				format: z.string().optional().describe("Format to check (e.g., 'gen9ou')"),
				limit: z.number().optional().describe("Number of checks/counters to show"),
			},
			async ({ pokemon, format, limit }) => ({
				content: [{ type: "text", text: await getChecksCounters({ pokemon, format, limit }, this.env) }],
			}),
		);

		// Get metagame stats tool
		this.server.tool(
			"get_metagame_stats",
			{
				format: z.string().optional().describe("Format to check (e.g., 'gen9ou')"),
			},
			async ({ format }) => ({
				content: [{ type: "text", text: await getMetagameStats({ format }, this.env) }],
			}),
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return PokemonMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return PokemonMCP.serve("/mcp").fetch(request, env, ctx);
		}

		// Root endpoint - return server info
		if (url.pathname === "/") {
			return new Response(
				JSON.stringify({
					name: "Pokémon MCP Server",
					version: "0.2.0",
					description: "Remote MCP server for Pokémon team building and validation",
					endpoints: {
						sse: "/sse",
						mcp: "/mcp",
					},
				}),
				{
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response("Not found", { status: 404 });
	},
};
