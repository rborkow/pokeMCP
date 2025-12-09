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
import { runIngestionPipeline, runTestIngestion } from "./ingestion/orchestrator.js";
import { queryStrategy, queryStrategyText } from "./rag/query.js";

// Define our Pokemon MCP agent with tools
export class PokemonMCP extends McpAgent {
	server = new McpServer({
		name: "Pokemon MCP Server",
		version: "0.3.0",
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

		// Query strategy - Natural language search over Smogon strategic content
		this.server.tool(
			"query_strategy",
			{
				query: z.string().describe("Natural language question about competitive strategy (e.g., 'How do I counter Garchomp?', 'What are Landorus-T's best sets?')"),
				format: z.string().optional().describe("Optional: Filter by format (e.g., 'gen9ou', 'gen9vgc2024regf')"),
				limit: z.number().optional().describe("Optional: Number of results to return (default: 5)"),
			},
			async ({ query, format, limit }) => ({
				content: [{ type: "text", text: await queryStrategyText({ query, format, limit }, this.env) }],
			}),
		);

		// Search strategic content - More specific search with detailed filters
		this.server.tool(
			"search_strategic_content",
			{
				query: z.string().describe("Search query for strategic content"),
				pokemon: z.string().optional().describe("Optional: Filter by specific Pokémon (e.g., 'garchomp', 'landorus-therian')"),
				format: z.string().optional().describe("Optional: Filter by format (e.g., 'gen9ou', 'gen9ubers')"),
				sectionType: z.enum(["overview", "moveset", "counters", "teammates"]).optional().describe("Optional: Filter by section type"),
				limit: z.number().optional().describe("Optional: Number of results to return (default: 5)"),
			},
			async ({ query, pokemon, format, sectionType, limit }) => ({
				content: [{ type: "text", text: await queryStrategyText({ query, pokemon, format, sectionType, limit }, this.env) }],
			}),
		);
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return PokemonMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return PokemonMCP.serve("/mcp").fetch(request, env, ctx);
		}

		// Test ingestion endpoint
		if (url.pathname === "/test-ingestion") {
			console.log("Test ingestion triggered manually");

			// Run async ingestion in background
			ctx.waitUntil(
				(async () => {
					try {
						const testPokemon = ["garchomp", "landorus-therian", "great-tusk"];
						const stats = await runTestIngestion(testPokemon, "gen9ou", env);
						console.log("Test ingestion completed:", stats);
					} catch (error) {
						console.error("Test ingestion failed:", error);
					}
				})()
			);

			return new Response(
				JSON.stringify({
					message: "Test ingestion started",
					pokemon: ["garchomp", "landorus-therian", "great-tusk"],
					format: "gen9ou",
					note: "Check logs for progress"
				}),
				{
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Test KV retrieval endpoint
		if (url.pathname === "/test-kv") {
			try {
				// Try to list a few keys from KV (from Vectorize list)
				const testKeys = [
					"garchomp-gen9ou-moveset-0",
					"garchomp-gen9ou-moveset-3",
					"garchomp-gen9ou-moveset-5",
					"landorus-therian-gen9ou-moveset-0",
					"landorus-therian-gen9ou-moveset-10",
					"great-tusk-gen9ou-moveset-3",
					"great-tusk-gen9ou-moveset-6"
				];

				const results: Record<string, any> = {};
				for (const key of testKeys) {
					const value = await env.STRATEGY_DOCS.get(key, 'json');
					results[key] = value ? { found: true, hasContent: !!value.content } : { found: false };
				}

				return new Response(
					JSON.stringify({
						message: "KV test completed",
						results
					}, null, 2),
					{
						headers: { "Content-Type": "application/json" },
					},
				);
			} catch (error) {
				return new Response(
					JSON.stringify({
						error: "KV test failed",
						details: error instanceof Error ? error.message : String(error)
					}),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		}

		// Debug Vectorize metadata endpoint
		if (url.pathname === "/debug-vectors") {
			try {
				// Get a sample of vectors to inspect metadata
				const sampleQuery = await env.VECTOR_INDEX.query(
					new Array(768).fill(0), // dummy vector
					{ topK: 5, returnMetadata: 'all' }
				);

				const vectors = sampleQuery.matches.map(m => ({
					id: m.id,
					score: m.score,
					metadata: m.metadata
				}));

				return new Response(
					JSON.stringify({ vectors }, null, 2),
					{
						headers: { "Content-Type": "application/json" },
					},
				);
			} catch (error) {
				return new Response(
					JSON.stringify({
						error: "Debug failed",
						details: error instanceof Error ? error.message : String(error)
					}),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		}

		// Test RAG query endpoint
		if (url.pathname === "/test-rag") {
			try {
				const query = url.searchParams.get('q') || 'How do I counter Garchomp?';
				const format = url.searchParams.get('format') || undefined;
				const pokemon = url.searchParams.get('pokemon') || undefined;

				console.log(`Testing RAG query: "${query}"`);

				const response = await queryStrategy({
					query,
					format,
					pokemon,
					limit: 5
				}, env);

				return new Response(
					JSON.stringify(response, null, 2),
					{
						headers: { "Content-Type": "application/json" },
					},
				);
			} catch (error) {
				return new Response(
					JSON.stringify({
						error: "RAG query failed",
						details: error instanceof Error ? error.message : String(error)
					}),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		}

		// Root endpoint - return server info
		if (url.pathname === "/") {
			return new Response(
				JSON.stringify({
					name: "Pokémon MCP Server",
					version: "0.3.0",
					description: "Remote MCP server for Pokémon team building, validation, and strategic analysis with RAG",
					tools: [
						"lookup_pokemon",
						"validate_moveset",
						"validate_team",
						"suggest_team_coverage",
						"get_popular_sets",
						"get_meta_threats",
						"get_teammates",
						"get_checks_counters",
						"get_metagame_stats",
						"query_strategy (NEW)",
						"search_strategic_content (NEW)"
					],
					endpoints: {
						sse: "/sse",
						mcp: "/mcp",
						"test-ingestion": "/test-ingestion",
						"test-kv": "/test-kv",
						"test-rag": "/test-rag?q=your+query",
						"debug-vectors": "/debug-vectors"
					},
				}),
				{
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		return new Response("Not found", { status: 404 });
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		console.log("Scheduled ingestion pipeline triggered at:", new Date(event.scheduledTime).toISOString());

		try {
			const stats = await runIngestionPipeline(env);
			console.log("Ingestion pipeline completed successfully:", stats);
		} catch (error) {
			console.error("Ingestion pipeline failed:", error);
		}
	},
};
