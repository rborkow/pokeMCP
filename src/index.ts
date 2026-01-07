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
import { withLogging } from "./logging.js";
import type { TeamPokemon } from "./types.js";

// CORS Configuration - restrict to known origins
const ALLOWED_ORIGINS = [
	"https://www.pokemcp.com",
	"https://pokemcp.com",
	"https://docs.pokemcp.com",
	"http://localhost:3000",
	"http://localhost:3001",
	"http://127.0.0.1:3000",
	"http://127.0.0.1:3001",
];

// Helper to get CORS headers with origin validation
function getCorsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get("Origin") || "";
	const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

	return {
		"Access-Control-Allow-Origin": allowedOrigin,
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
		"Vary": "Origin", // Important for caching
	};
}

// Validate request origin (returns false for disallowed origins)
function isOriginAllowed(request: Request): boolean {
	const origin = request.headers.get("Origin");
	// Allow requests without Origin header (direct API calls, curl, etc.)
	if (!origin) return true;
	return ALLOWED_ORIGINS.includes(origin);
}

// AI Chat types
interface AIChatRequest {
	system?: string;
	message: string;
	team?: TeamPokemon[];
	format?: string;
}

interface AIChatResponse {
	content: string;
	context?: {
		metaThreats?: string;
		coverage?: string;
		strategy?: string;
	};
}

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
			async ({ pokemon, generation }) => {
				const text = await withLogging(
					this.env as Env,
					"lookup_pokemon",
					{ pokemon, generation },
					() => lookupPokemon({ pokemon, generation })
				);
				return { content: [{ type: "text", text }] };
			},
		);

		// Validate moveset tool
		this.server.tool(
			"validate_moveset",
			{
				pokemon: z.string().describe("The Pokémon name"),
				moves: z.array(z.string()).describe("Array of move names to validate"),
				generation: z.string().optional().describe("Game generation (e.g., '9')"),
			},
			async ({ pokemon, moves, generation }) => {
				const text = await withLogging(
					this.env as Env,
					"validate_moveset",
					{ pokemon, moves, generation },
					() => validateMoveset({ pokemon, moves, generation })
				);
				return { content: [{ type: "text", text }] };
			},
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
			async ({ team, format }) => {
				const text = await withLogging(
					this.env as Env,
					"validate_team",
					{ team, format },
					() => validateTeam({ team, format })
				);
				return { content: [{ type: "text", text }] };
			},
		);

		// Suggest team coverage tool
		this.server.tool(
			"suggest_team_coverage",
			{
				current_team: z.array(z.string()).describe("Array of Pokémon names currently on the team"),
				format: z.string().optional().describe("Format for suggestions (e.g., 'OU')"),
			},
			async ({ current_team, format }) => {
				const text = await withLogging(
					this.env as Env,
					"suggest_team_coverage",
					{ current_team, format },
					() => suggestTeamCoverage({ current_team, format })
				);
				return { content: [{ type: "text", text }] };
			},
		);

		// Get popular sets tool
		this.server.tool(
			"get_popular_sets",
			{
				pokemon: z.string().describe("The Pokémon name"),
				format: z.string().optional().describe("Format to check (e.g., 'gen9ou', 'gen9vgc2024')"),
			},
			async ({ pokemon, format }) => {
				const env = this.env as Env;
				const text = await withLogging(
					env,
					"get_popular_sets",
					{ pokemon, format },
					() => getPopularSets({ pokemon, format }, env)
				);
				return { content: [{ type: "text", text }] };
			},
		);

		// Get meta threats tool
		this.server.tool(
			"get_meta_threats",
			{
				format: z.string().optional().describe("Format to check (e.g., 'gen9ou', 'gen9ubers')"),
				limit: z.number().optional().describe("Number of top Pokémon to show"),
			},
			async ({ format, limit }) => {
				const env = this.env as Env;
				const text = await withLogging(
					env,
					"get_meta_threats",
					{ format, limit },
					() => getMetaThreats({ format, limit }, env)
				);
				return { content: [{ type: "text", text }] };
			},
		);

		// Get teammates tool
		this.server.tool(
			"get_teammates",
			{
				pokemon: z.string().describe("The Pokémon name"),
				format: z.string().optional().describe("Format to check (e.g., 'gen9ou')"),
				limit: z.number().optional().describe("Number of teammates to show"),
			},
			async ({ pokemon, format, limit }) => {
				const env = this.env as Env;
				const text = await withLogging(
					env,
					"get_teammates",
					{ pokemon, format, limit },
					() => getTeammates({ pokemon, format, limit }, env)
				);
				return { content: [{ type: "text", text }] };
			},
		);

		// Get checks and counters tool
		this.server.tool(
			"get_checks_counters",
			{
				pokemon: z.string().describe("The Pokémon name"),
				format: z.string().optional().describe("Format to check (e.g., 'gen9ou')"),
				limit: z.number().optional().describe("Number of checks/counters to show"),
			},
			async ({ pokemon, format, limit }) => {
				const env = this.env as Env;
				const text = await withLogging(
					env,
					"get_checks_counters",
					{ pokemon, format, limit },
					() => getChecksCounters({ pokemon, format, limit }, env)
				);
				return { content: [{ type: "text", text }] };
			},
		);

		// Get metagame stats tool
		this.server.tool(
			"get_metagame_stats",
			{
				format: z.string().optional().describe("Format to check (e.g., 'gen9ou')"),
			},
			async ({ format }) => {
				const env = this.env as Env;
				const text = await withLogging(
					env,
					"get_metagame_stats",
					{ format },
					() => getMetagameStats({ format }, env)
				);
				return { content: [{ type: "text", text }] };
			},
		);

		// Query strategy - Natural language search over Smogon strategic content
		this.server.tool(
			"query_strategy",
			{
				query: z.string().describe("Natural language question about competitive strategy (e.g., 'How do I counter Garchomp?', 'What are Landorus-T's best sets?')"),
				format: z.string().optional().describe("Optional: Filter by format (e.g., 'gen9ou', 'gen9vgc2024regf')"),
				limit: z.number().optional().describe("Optional: Number of results to return (default: 5)"),
			},
			async ({ query, format, limit }) => {
				const env = this.env as Env;
				const text = await withLogging(
					env,
					"query_strategy",
					{ query, format, limit },
					() => queryStrategyText({ query, format, limit }, env)
				);
				return { content: [{ type: "text", text }] };
			},
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
			async ({ query, pokemon, format, sectionType, limit }) => {
				const env = this.env as Env;
				const text = await withLogging(
					env,
					"search_strategic_content",
					{ query, pokemon, format, sectionType, limit },
					() => queryStrategyText({ query, pokemon, format, sectionType, limit }, env)
				);
				return { content: [{ type: "text", text }] };
			},
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

		// Stateless tool call endpoint - bypasses session requirement
		// Use this for direct API access from web apps
		if (url.pathname === "/api/tools" && request.method === "POST") {
			const corsHeaders = {
				...getCorsHeaders(request),
				"Content-Type": "application/json",
			};

			// Validate origin
			if (!isOriginAllowed(request)) {
				return new Response(
					JSON.stringify({ error: "Origin not allowed" }),
					{ status: 403, headers: corsHeaders }
				);
			}

			try {
				const body = await request.json();
				const { tool, args } = body as { tool: string; args: Record<string, unknown> };

				if (!tool) {
					return new Response(
						JSON.stringify({ error: "Tool name is required" }),
						{ status: 400, headers: corsHeaders }
					);
				}

				let result: string;
				switch (tool) {
					case "lookup_pokemon":
						result = await withLogging(env, tool, args, () =>
							lookupPokemon(args as { pokemon: string; generation?: string }),
							undefined, ctx
						);
						break;
					case "validate_moveset":
						result = await withLogging(env, tool, args, () =>
							validateMoveset(args as { pokemon: string; moves: string[]; generation?: string }),
							undefined, ctx
						);
						break;
					case "validate_team":
						result = await withLogging(env, tool, args, () =>
							validateTeam(args as { team: any[]; format?: string }),
							undefined, ctx
						);
						break;
					case "suggest_team_coverage":
						result = await withLogging(env, tool, args, () =>
							suggestTeamCoverage(args as { current_team: string[]; format?: string }),
							undefined, ctx
						);
						break;
					case "get_popular_sets":
						result = await withLogging(env, tool, args, () =>
							getPopularSets(args as { pokemon: string; format?: string }, env),
							undefined, ctx
						);
						break;
					case "get_meta_threats":
						result = await withLogging(env, tool, args, () =>
							getMetaThreats(args as { format?: string; limit?: number }, env),
							undefined, ctx
						);
						break;
					case "get_teammates":
						result = await withLogging(env, tool, args, () =>
							getTeammates(args as { pokemon: string; format?: string; limit?: number }, env),
							undefined, ctx
						);
						break;
					case "get_checks_counters":
						result = await withLogging(env, tool, args, () =>
							getChecksCounters(args as { pokemon: string; format?: string; limit?: number }, env),
							undefined, ctx
						);
						break;
					case "get_metagame_stats":
						result = await withLogging(env, tool, args, () =>
							getMetagameStats(args as { format?: string }, env),
							undefined, ctx
						);
						break;
					case "query_strategy":
						result = await withLogging(env, tool, args, async () => {
							const strategyResult = await queryStrategy(args as { query: string; format?: string; pokemon?: string; limit?: number }, env);
							return typeof strategyResult === 'string' ? strategyResult : JSON.stringify(strategyResult);
						}, undefined, ctx);
						break;
					default:
						return new Response(
							JSON.stringify({ error: `Unknown tool: ${tool}` }),
							{ status: 400, headers: corsHeaders }
						);
				}

				return new Response(
					JSON.stringify({
						jsonrpc: "2.0",
						id: body.id || null,
						result: {
							content: [{ type: "text", text: result }]
						}
					}),
					{ headers: corsHeaders }
				);
			} catch (error) {
				console.error("API tools error:", error);
				return new Response(
					JSON.stringify({
						error: "Tool execution failed",
						details: error instanceof Error ? error.message : String(error)
					}),
					{ status: 500, headers: { ...corsHeaders } }
				);
			}
		}

		// CORS preflight for /api/tools
		if (url.pathname === "/api/tools" && request.method === "OPTIONS") {
			return new Response(null, {
				headers: getCorsHeaders(request),
			});
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

		// AI Chat endpoint - handles team builder AI assistant requests
		if (url.pathname === "/ai/chat" && request.method === "POST") {
			// Add CORS headers for cross-origin requests
			const corsHeaders = {
				...getCorsHeaders(request),
				"Content-Type": "application/json",
			};

			// Validate origin
			if (!isOriginAllowed(request)) {
				return new Response(
					JSON.stringify({ error: "Origin not allowed" }),
					{ status: 403, headers: corsHeaders }
				);
			}

			try {
				const body: AIChatRequest = await request.json();
				const { system, message, team = [], format = "gen9ou" } = body;

				if (!message) {
					return new Response(
						JSON.stringify({ error: "Message is required" }),
						{ status: 400, headers: corsHeaders }
					);
				}

				console.log(`AI Chat request: "${message.substring(0, 100)}..." format=${format} team_size=${team.length}`);

				// Gather relevant context based on the message
				const context: AIChatResponse["context"] = {};

				// Get meta threats for context
				try {
					const metaThreats = await getMetaThreats({ format, limit: 10 }, env);
					context.metaThreats = metaThreats;
				} catch (e) {
					console.error("Failed to get meta threats:", e);
				}

				// Get coverage analysis if team exists
				if (team.length > 0) {
					try {
						const teamNames = team.map(p => p.pokemon);
						const coverage = suggestTeamCoverage({ current_team: teamNames, format });
						context.coverage = coverage;
					} catch (e) {
						console.error("Failed to get coverage:", e);
					}
				}

				// Get strategic content via RAG if the message seems strategic
				const strategicKeywords = ["counter", "check", "threat", "weakness", "coverage", "improve", "suggest", "rate", "fix"];
				const isStrategicQuery = strategicKeywords.some(kw => message.toLowerCase().includes(kw));

				if (isStrategicQuery) {
					try {
						const strategyResponse = await queryStrategy({ query: message, format, limit: 3 }, env);
						if (strategyResponse.results && strategyResponse.results.length > 0) {
							context.strategy = strategyResponse.results.map((r: { content: string }) => r.content).join("\n\n");
						}
					} catch (e) {
						console.error("Failed to get strategy:", e);
					}
				}

				// Extract Pokemon mentioned in the message to fetch their popular sets
				const commonPokemon = ["Garchomp", "Landorus", "Great Tusk", "Kingambit", "Gholdengo", "Dragapult", "Iron Valiant", "Roaring Moon", "Skeledirge", "Arcanine", "Heatran", "Toxapex", "Clefable", "Corviknight", "Ferrothorn", "Dragonite", "Volcarona", "Tyranitar", "Excadrill", "Gliscor"];
				const pokemonMentioned: string[] = [];
				for (const mon of commonPokemon) {
					if (message.toLowerCase().includes(mon.toLowerCase())) {
						pokemonMentioned.push(mon);
					}
				}

				// Fetch popular sets for mentioned Pokemon (verified legal movesets)
				let popularSetsContext = "";
				for (const pokemon of pokemonMentioned.slice(0, 3)) {
					try {
						const setsText = await getPopularSets({ pokemon, format }, env);
						if (setsText && !setsText.includes("not found")) {
							popularSetsContext += `\n\n${setsText}`;
						}
					} catch (e) {
						console.error(`Failed to fetch sets for ${pokemon}:`, e);
					}
				}

				// Format team for context
				const teamContext = team.length > 0
					? team.map((p, i) => {
						const parts = [`${i + 1}. ${p.pokemon}`];
						if (p.item) parts.push(`@ ${p.item}`);
						if (p.ability) parts.push(`(${p.ability})`);
						if (p.moves && p.moves.length > 0) parts.push(`- Moves: ${p.moves.join(", ")}`);
						return parts.join(" ");
					}).join("\n")
					: "No Pokemon in team yet.";

				// Build the full prompt for the AI
				const teamSize = team.length;
				const systemPrompt = system || `You are a Pokemon competitive team building assistant for ${format.toUpperCase()}.

CRITICAL RULES:
1. ONLY suggest Pokemon that are legal in ${format.toUpperCase()}. Reference the meta threats list.
2. ONLY use moves from the "Popular Moves" section when provided. These are VERIFIED learnable moves.
3. If no popular sets are provided for a Pokemon, use ONLY standard competitive moves you are certain it can learn.
4. NEVER suggest moves like Trick Room, Wish, or other specialized moves unless you see them in the Popular Moves list.
5. Use REAL abilities from the "Popular Abilities" section when provided.
6. When suggesting team changes, you MUST use the [ACTION] block format shown below.
7. ALWAYS include competitive EV spreads (totaling 508-510 EVs). Common spreads:
   - Offensive: 252 Atk or SpA / 4 Def or SpD / 252 Spe
   - Bulky: 252 HP / 252 Def or SpD / 4 Atk or SpA
   - Mixed bulk: 252 HP / 128 Def / 128 SpD

CURRENT TEAM STATUS:
- Team has ${teamSize} Pokemon (slots 0-${teamSize - 1} are filled, slots ${teamSize}-5 are empty)
- Use "add_pokemon" ONLY for empty slots (${teamSize > 5 ? "team is full!" : `slot ${teamSize} is the next empty slot`})
- Use "replace_pokemon" to swap out an existing Pokemon at their slot
- Use "update_moveset" to modify moves/item/ability of an existing Pokemon without replacing it

When suggesting a specific team change, wrap it in [ACTION] tags like this:

[ACTION]
{"type":"add_pokemon","slot":${teamSize},"payload":{"pokemon":"Great Tusk","moves":["Headlong Rush","Close Combat","Ice Spinner","Rapid Spin"],"ability":"Protosynthesis","item":"Booster Energy","nature":"Jolly","teraType":"Ground","evs":{"hp":0,"atk":252,"def":4,"spa":0,"spd":0,"spe":252}},"reason":"Adds Ground coverage and hazard removal"}
[/ACTION]

Guidelines:
- Be concise and actionable
- Reference the meta threats when suggesting counters
- Explain type synergies briefly
- Only suggest changes when the user asks for them
- If suggesting to replace a Pokemon, reference which one by name and slot number
- When in doubt about a move, check the Popular Moves list or suggest a safe STAB move`;

				// Build context section
				let contextSection = "";
				if (context.metaThreats) {
					contextSection += `\n\n## Current Meta Threats (${format}):\n${context.metaThreats}`;
				}
				if (popularSetsContext) {
					contextSection += `\n\n## Popular Sets (USE THESE MOVES - they are verified legal):${popularSetsContext}`;
				}
				if (context.coverage) {
					contextSection += `\n\n## Team Coverage Analysis:\n${context.coverage}`;
				}
				if (context.strategy) {
					contextSection += `\n\n## Relevant Strategic Information:\n${context.strategy}`;
				}

				const fullUserMessage = `Current Team:
${teamContext}
${contextSection}

User's Question: ${message}`;

				// Helper function to validate ACTION blocks using our MCP tools
				const validateActionBlock = (actionJson: string): { valid: boolean; warnings: string[] } => {
					const warnings: string[] = [];
					try {
						const action = JSON.parse(actionJson);
						if (action.payload?.pokemon && action.payload?.moves) {
							const validation = validateMoveset({
								pokemon: action.payload.pokemon,
								moves: action.payload.moves,
								generation: format.startsWith('gen9') ? '9' : format.startsWith('gen8') ? '8' : '9'
							});
							// Check for illegal moves in the validation result
							if (validation.includes('❌')) {
								const illegalMatches = validation.match(/❌ \*\*([^*]+)\*\*: ([^\n]+)/g);
								if (illegalMatches) {
									for (const match of illegalMatches) {
										warnings.push(match.replace(/\*\*/g, ''));
									}
								}
							}
						}
					} catch (e) {
						// JSON parse error - let it through
					}
					return { valid: warnings.length === 0, warnings };
				};

				// Require Anthropic API key
				if (!env.ANTHROPIC_API_KEY) {
					return new Response(
						JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
						{ status: 503, headers: corsHeaders }
					);
				}

				// Call Claude Sonnet 4.5
				console.log("Using Claude Sonnet 4.5 for AI chat");
				const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": env.ANTHROPIC_API_KEY,
						"anthropic-version": "2023-06-01",
					},
					body: JSON.stringify({
						model: "claude-sonnet-4-5-20250514",
						max_tokens: 1024,
						system: systemPrompt,
						messages: [{ role: "user", content: fullUserMessage }],
					}),
				});

				if (!claudeResponse.ok) {
					const errorText = await claudeResponse.text();
					console.error("Claude API error:", errorText);
					return new Response(
						JSON.stringify({ error: "Claude API request failed", details: errorText }),
						{ status: 502, headers: corsHeaders }
					);
				}

				const claudeData = await claudeResponse.json() as { content?: Array<{ text?: string }> };
				let content = claudeData.content?.[0]?.text || "";
				console.log(`Claude response generated, length=${content.length}`);

				// Validate any ACTION blocks in the response using our MCP tools
				const actionBlockRegex = /\[ACTION\]([\s\S]*?)\[\/ACTION\]/g;
				const actionMatches = content.matchAll(actionBlockRegex);
				const allWarnings: string[] = [];

				for (const match of actionMatches) {
					const actionJson = match[1].trim();
					const { valid, warnings } = validateActionBlock(actionJson);
					if (!valid) {
						allWarnings.push(...warnings);
						console.log(`Move validation warnings: ${warnings.join(', ')}`);
					}
				}

				// Append warnings to content if there are invalid moves
				if (allWarnings.length > 0) {
					content += `\n\n⚠️ **Move Legality Warning:** The following moves may not be learnable:\n${allWarnings.map(w => `- ${w}`).join('\n')}\n\nPlease verify these moves before applying.`;
				}

				return new Response(
					JSON.stringify({ content, context }),
					{ headers: corsHeaders }
				);

			} catch (error) {
				console.error("AI Chat error:", error);
				return new Response(
					JSON.stringify({
						error: "Failed to process AI request",
						details: error instanceof Error ? error.message : String(error)
					}),
					{
						status: 500,
						headers: {
							...getCorsHeaders(request),
							"Content-Type": "application/json",
						},
					}
				);
			}
		}

		// Handle CORS preflight for /ai/chat
		if (url.pathname === "/ai/chat" && request.method === "OPTIONS") {
			return new Response(null, {
				headers: getCorsHeaders(request),
			});
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
						"ai/chat": "/ai/chat (POST) - AI assistant for team builder",
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
