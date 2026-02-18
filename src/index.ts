import { EmailMessage } from "cloudflare:email";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { createMimeMessage } from "mimetext/browser";
import { detectPokemonMentions } from "./data-loader.js";
import { runIngestionPipeline, runTestIngestion } from "./ingestion/orchestrator.js";
import { withLogging } from "./logging.js";
import { queryStrategy } from "./rag/query.js";
import {
    checkRateLimit,
    getSharedTeam,
    refreshSharedTeamTtl,
    storeSharedTeam,
    validateTeamForSharing,
} from "./share.js";
import { getMetaThreats, getPopularSets } from "./stats.js";
import { TOOL_REGISTRY } from "./tool-registry.js";
import { suggestTeamCoverage, validateMoveset } from "./tools.js";
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
        Vary: "Origin", // Important for caching
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
        const env = this.env as Env;
        for (const tool of TOOL_REGISTRY) {
            this.server.tool(tool.name, tool.schema, async (args) => {
                const text = await withLogging(env, tool.name, args, () => tool.execute(args, env));
                return { content: [{ type: "text", text }] };
            });
        }
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
                return new Response(JSON.stringify({ error: "Origin not allowed" }), {
                    status: 403,
                    headers: corsHeaders,
                });
            }

            try {
                const body = (await request.json()) as {
                    tool: string;
                    args: Record<string, unknown>;
                    id?: unknown;
                };
                const { tool, args } = body;

                if (!tool) {
                    return new Response(JSON.stringify({ error: "Tool name is required" }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }

                const toolDef = TOOL_REGISTRY.find((t) => t.name === tool);
                if (!toolDef) {
                    return new Response(JSON.stringify({ error: `Unknown tool: ${tool}` }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }

                const result = await withLogging(
                    env,
                    tool,
                    args,
                    () => toolDef.execute(args, env),
                    undefined,
                    ctx,
                );

                return new Response(
                    JSON.stringify({
                        jsonrpc: "2.0",
                        id: body.id || null,
                        result: {
                            content: [{ type: "text", text: result }],
                        },
                    }),
                    { headers: corsHeaders },
                );
            } catch (error) {
                console.error("API tools error:", error);
                return new Response(
                    JSON.stringify({
                        error: "Tool execution failed",
                        details: error instanceof Error ? error.message : String(error),
                    }),
                    { status: 500, headers: { ...corsHeaders } },
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
                })(),
            );

            return new Response(
                JSON.stringify({
                    message: "Test ingestion started",
                    pokemon: ["garchomp", "landorus-therian", "great-tusk"],
                    format: "gen9ou",
                    note: "Check logs for progress",
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
                    "great-tusk-gen9ou-moveset-6",
                ];

                const results: Record<string, any> = {};
                for (const key of testKeys) {
                    const value = await env.STRATEGY_DOCS.get(key, "json");
                    results[key] = value
                        ? { found: true, hasContent: !!(value as any).content }
                        : { found: false };
                }

                return new Response(
                    JSON.stringify(
                        {
                            message: "KV test completed",
                            results,
                        },
                        null,
                        2,
                    ),
                    {
                        headers: { "Content-Type": "application/json" },
                    },
                );
            } catch (error) {
                return new Response(
                    JSON.stringify({
                        error: "KV test failed",
                        details: error instanceof Error ? error.message : String(error),
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
                    { topK: 5, returnMetadata: "all" },
                );

                const vectors = sampleQuery.matches.map((m) => ({
                    id: m.id,
                    score: m.score,
                    metadata: m.metadata,
                }));

                return new Response(JSON.stringify({ vectors }, null, 2), {
                    headers: { "Content-Type": "application/json" },
                });
            } catch (error) {
                return new Response(
                    JSON.stringify({
                        error: "Debug failed",
                        details: error instanceof Error ? error.message : String(error),
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
                const query = url.searchParams.get("q") || "How do I counter Garchomp?";
                const format = url.searchParams.get("format") || undefined;
                const pokemon = url.searchParams.get("pokemon") || undefined;

                console.log(`Testing RAG query: "${query}"`);

                const response = await queryStrategy(
                    {
                        query,
                        format,
                        pokemon,
                        limit: 5,
                    },
                    env,
                );

                return new Response(JSON.stringify(response, null, 2), {
                    headers: { "Content-Type": "application/json" },
                });
            } catch (error) {
                return new Response(
                    JSON.stringify({
                        error: "RAG query failed",
                        details: error instanceof Error ? error.message : String(error),
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
                return new Response(JSON.stringify({ error: "Origin not allowed" }), {
                    status: 403,
                    headers: corsHeaders,
                });
            }

            try {
                const body: AIChatRequest = await request.json();
                const { system, message, team = [], format = "gen9ou" } = body;

                if (!message) {
                    return new Response(JSON.stringify({ error: "Message is required" }), {
                        status: 400,
                        headers: corsHeaders,
                    });
                }

                console.log(
                    `AI Chat request: "${message.substring(0, 100)}..." format=${format} team_size=${team.length}`,
                );

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
                        const teamNames = team.map((p) => p.pokemon);
                        const coverage = suggestTeamCoverage({
                            current_team: teamNames,
                            format,
                        });
                        context.coverage = coverage;
                    } catch (e) {
                        console.error("Failed to get coverage:", e);
                    }
                }

                // Get strategic content via RAG if the message seems strategic
                const strategicKeywords = [
                    "counter",
                    "check",
                    "threat",
                    "weakness",
                    "coverage",
                    "improve",
                    "suggest",
                    "rate",
                    "fix",
                ];
                const isStrategicQuery = strategicKeywords.some((kw) =>
                    message.toLowerCase().includes(kw),
                );

                if (isStrategicQuery) {
                    try {
                        const strategyResponse = await queryStrategy(
                            { query: message, format, limit: 3 },
                            env,
                        );
                        if (strategyResponse.results && strategyResponse.results.length > 0) {
                            context.strategy = strategyResponse.results
                                .map((r: { content: string }) => r.content)
                                .join("\n\n");
                        }
                    } catch (e) {
                        console.error("Failed to get strategy:", e);
                    }
                }

                // Extract Pokemon mentioned in the message to fetch their popular sets
                const pokemonMentioned = detectPokemonMentions(message, 3);

                // Fetch popular sets for mentioned Pokemon (verified legal movesets)
                let popularSetsContext = "";
                for (const pokemon of pokemonMentioned) {
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
                const teamContext =
                    team.length > 0
                        ? team
                              .map((p, i) => {
                                  const parts = [`${i + 1}. ${p.pokemon}`];
                                  if (p.item) parts.push(`@ ${p.item}`);
                                  if (p.ability) parts.push(`(${p.ability})`);
                                  if (p.moves && p.moves.length > 0)
                                      parts.push(`- Moves: ${p.moves.join(", ")}`);
                                  return parts.join(" ");
                              })
                              .join("\n")
                        : "No Pokemon in team yet.";

                // Build the full prompt for the AI
                const teamSize = team.length;
                const systemPrompt =
                    system ||
                    `You are a Pokemon competitive team building assistant for ${format.toUpperCase()}.

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
                const validateActionBlock = (
                    actionJson: string,
                ): { valid: boolean; warnings: string[] } => {
                    const warnings: string[] = [];
                    try {
                        const action = JSON.parse(actionJson);
                        if (action.payload?.pokemon && action.payload?.moves) {
                            const validation = validateMoveset({
                                pokemon: action.payload.pokemon,
                                moves: action.payload.moves,
                                generation: format.startsWith("gen9")
                                    ? "9"
                                    : format.startsWith("gen8")
                                      ? "8"
                                      : "9",
                            });
                            // Check for illegal moves in the validation result
                            if (validation.includes("❌")) {
                                const illegalMatches = validation.match(
                                    /❌ \*\*([^*]+)\*\*: ([^\n]+)/g,
                                );
                                if (illegalMatches) {
                                    for (const match of illegalMatches) {
                                        warnings.push(match.replace(/\*\*/g, ""));
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
                        { status: 503, headers: corsHeaders },
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
                        JSON.stringify({
                            error: "Claude API request failed",
                            details: errorText,
                        }),
                        { status: 502, headers: corsHeaders },
                    );
                }

                const claudeData = (await claudeResponse.json()) as {
                    content?: Array<{ text?: string }>;
                };
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
                        console.log(`Move validation warnings: ${warnings.join(", ")}`);
                    }
                }

                // Append warnings to content if there are invalid moves
                if (allWarnings.length > 0) {
                    content += `\n\n⚠️ **Move Legality Warning:** The following moves may not be learnable:\n${allWarnings.map((w) => `- ${w}`).join("\n")}\n\nPlease verify these moves before applying.`;
                }

                return new Response(JSON.stringify({ content, context }), {
                    headers: corsHeaders,
                });
            } catch (error) {
                console.error("AI Chat error:", error);
                return new Response(
                    JSON.stringify({
                        error: "Failed to process AI request",
                        details: error instanceof Error ? error.message : String(error),
                    }),
                    {
                        status: 500,
                        headers: {
                            ...getCorsHeaders(request),
                            "Content-Type": "application/json",
                        },
                    },
                );
            }
        }

        // Handle CORS preflight for /ai/chat
        if (url.pathname === "/ai/chat" && request.method === "OPTIONS") {
            return new Response(null, {
                headers: getCorsHeaders(request),
            });
        }

        // Feedback submission endpoint
        async function sendFeedbackNotification(
            feedbackEnv: Env,
            feedback: {
                id: string;
                type: string;
                message: string;
                email?: string;
                page?: string;
                timestamp: string;
            },
        ): Promise<void> {
            if (!feedbackEnv.SEND_EMAIL) {
                console.warn("[Feedback] Email binding not configured, skipping notification");
                return;
            }

            const typeLabel = feedback.type.charAt(0).toUpperCase() + feedback.type.slice(1);
            const msg = createMimeMessage();
            msg.setSender({ name: "PokeMCP Feedback", addr: "feedback@pokemcp.com" });
            msg.setRecipient("feedback@pokemcp.com");
            msg.setSubject(`[${typeLabel}] New feedback received`);
            msg.addMessage({
                contentType: "text/plain",
                data: [
                    `New ${feedback.type} feedback submitted`,
                    "",
                    `ID: ${feedback.id}`,
                    `Type: ${typeLabel}`,
                    `Time: ${feedback.timestamp}`,
                    feedback.page ? `Page: ${feedback.page}` : null,
                    feedback.email ? `Contact: ${feedback.email}` : null,
                    "",
                    "--- Message ---",
                    feedback.message,
                ]
                    .filter(Boolean)
                    .join("\n"),
            });

            const emailMsg = new EmailMessage(
                "feedback@pokemcp.com",
                "feedback@pokemcp.com",
                msg.asRaw(),
            );

            await feedbackEnv.SEND_EMAIL.send(emailMsg);
        }

        if (url.pathname === "/api/feedback" && request.method === "POST") {
            const corsHeaders = {
                ...getCorsHeaders(request),
                "Content-Type": "application/json",
            };

            if (!isOriginAllowed(request)) {
                return new Response(JSON.stringify({ error: "Origin not allowed" }), {
                    status: 403,
                    headers: corsHeaders,
                });
            }

            try {
                const body = (await request.json()) as {
                    type?: string;
                    message?: string;
                    email?: string;
                    page?: string;
                };

                const { type, message, email, page } = body;

                // Validate type
                const validTypes = ["bug", "feature", "feedback"];
                if (!type || !validTypes.includes(type)) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
                        }),
                        { status: 400, headers: corsHeaders },
                    );
                }

                // Validate message
                if (!message || typeof message !== "string") {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: "Message is required",
                        }),
                        { status: 400, headers: corsHeaders },
                    );
                }

                const trimmed = message.trim();
                if (trimmed.length < 10) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: "Message must be at least 10 characters",
                        }),
                        { status: 400, headers: corsHeaders },
                    );
                }

                if (trimmed.length > 5000) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: "Message must be 5000 characters or less",
                        }),
                        { status: 400, headers: corsHeaders },
                    );
                }

                // Validate optional email format
                if (email && typeof email === "string" && email.trim().length > 0) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email.trim())) {
                        return new Response(
                            JSON.stringify({
                                success: false,
                                error: "Invalid email format",
                            }),
                            { status: 400, headers: corsHeaders },
                        );
                    }
                }

                const id = crypto.randomUUID();
                const now = new Date();
                const feedbackEntry = {
                    id,
                    type,
                    message: trimmed,
                    email: email?.trim() || undefined,
                    page: page || undefined,
                    timestamp: now.toISOString(),
                };

                // Store in R2 under feedback/YYYY/MM/DD/{uuid}.json
                if (env.INTERACTION_LOGS) {
                    const path = [
                        "feedback",
                        now.getUTCFullYear(),
                        String(now.getUTCMonth() + 1).padStart(2, "0"),
                        String(now.getUTCDate()).padStart(2, "0"),
                        `${id}.json`,
                    ].join("/");

                    ctx.waitUntil(
                        env.INTERACTION_LOGS.put(path, JSON.stringify(feedbackEntry), {
                            httpMetadata: { contentType: "application/json" },
                        }),
                    );
                } else {
                    console.warn("[Feedback] R2 bucket not configured, logging to console");
                    console.log("[Feedback]", JSON.stringify(feedbackEntry));
                }

                // Send email notification (non-blocking)
                ctx.waitUntil(
                    sendFeedbackNotification(env, feedbackEntry).catch((err) => {
                        console.error("[Feedback] Email notification failed:", err);
                    }),
                );

                return new Response(JSON.stringify({ success: true, id }), {
                    headers: corsHeaders,
                });
            } catch (error) {
                console.error("Feedback endpoint error:", error);
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: "Failed to process feedback",
                    }),
                    { status: 500, headers: corsHeaders },
                );
            }
        }

        // CORS preflight for /api/feedback
        if (url.pathname === "/api/feedback" && request.method === "OPTIONS") {
            return new Response(null, {
                headers: getCorsHeaders(request),
            });
        }

        // Team sharing: create a shared team with short URL
        if (url.pathname === "/api/team/share" && request.method === "POST") {
            const corsHeaders = {
                ...getCorsHeaders(request),
                "Content-Type": "application/json",
            };

            if (!isOriginAllowed(request)) {
                return new Response(JSON.stringify({ error: "Origin not allowed" }), {
                    status: 403,
                    headers: corsHeaders,
                });
            }

            try {
                // Rate limit by IP
                const ip = request.headers.get("CF-Connecting-IP") || "unknown";
                const allowed = await checkRateLimit(env.SHARED_TEAMS, ip);
                if (!allowed) {
                    return new Response(
                        JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }),
                        { status: 429, headers: corsHeaders },
                    );
                }

                const body = (await request.json()) as {
                    team?: unknown;
                    format?: unknown;
                };

                const validation = validateTeamForSharing(body.team, body.format);
                if (!validation.valid) {
                    return new Response(
                        JSON.stringify({
                            error: (validation as { valid: false; error: string }).error,
                        }),
                        { status: 400, headers: corsHeaders },
                    );
                }

                const { team, format } = validation;
                const id = await storeSharedTeam(env.SHARED_TEAMS, team, format);

                return new Response(
                    JSON.stringify({
                        id,
                        url: `https://www.pokemcp.com/t/${id}`,
                    }),
                    { headers: corsHeaders },
                );
            } catch (error) {
                console.error("Team share error:", error);
                return new Response(
                    JSON.stringify({
                        error: "Failed to share team",
                        details: error instanceof Error ? error.message : String(error),
                    }),
                    { status: 500, headers: corsHeaders },
                );
            }
        }

        // CORS preflight for /api/team/*
        if (url.pathname.startsWith("/api/team/") && request.method === "OPTIONS") {
            return new Response(null, {
                headers: getCorsHeaders(request),
            });
        }

        // Team sharing: retrieve a shared team by ID
        if (url.pathname.startsWith("/api/team/") && request.method === "GET") {
            const corsHeaders = {
                ...getCorsHeaders(request),
                "Content-Type": "application/json",
            };

            const id = url.pathname.replace("/api/team/", "");
            if (!id || id.includes("/")) {
                return new Response(JSON.stringify({ error: "Invalid team ID" }), {
                    status: 400,
                    headers: corsHeaders,
                });
            }

            try {
                const sharedTeam = await getSharedTeam(env.SHARED_TEAMS, id);
                if (!sharedTeam) {
                    return new Response(JSON.stringify({ error: "Team not found" }), {
                        status: 404,
                        headers: corsHeaders,
                    });
                }

                // Refresh TTL in background so frequently-accessed teams don't expire
                ctx.waitUntil(refreshSharedTeamTtl(env.SHARED_TEAMS, id));

                return new Response(JSON.stringify(sharedTeam), {
                    headers: {
                        ...corsHeaders,
                        "Cache-Control": "public, max-age=300",
                    },
                });
            } catch (error) {
                console.error("Team retrieve error:", error);
                return new Response(JSON.stringify({ error: "Failed to retrieve team" }), {
                    status: 500,
                    headers: corsHeaders,
                });
            }
        }

        // OG image generation for shared teams
        if (url.pathname.startsWith("/og/team/") && request.method === "GET") {
            const id = url.pathname.replace("/og/team/", "");
            if (!id || id.includes("/")) {
                return new Response("Invalid team ID", { status: 400 });
            }

            try {
                const sharedTeam = await getSharedTeam(env.SHARED_TEAMS, id);
                if (!sharedTeam) {
                    return new Response("Team not found", { status: 404 });
                }

                const { renderTeamOgImage } = await import("./og/render.js");
                const png = await renderTeamOgImage(sharedTeam);

                return new Response(png, {
                    headers: {
                        "Content-Type": "image/png",
                        "Cache-Control": "public, max-age=604800, s-maxage=604800",
                    },
                });
            } catch (error) {
                console.error("OG image generation error:", error);
                return new Response("Failed to generate image", { status: 500 });
            }
        }

        // Root endpoint - return server info
        if (url.pathname === "/") {
            return new Response(
                JSON.stringify({
                    name: "Pokémon MCP Server",
                    version: "0.3.0",
                    description:
                        "Remote MCP server for Pokémon team building, validation, and strategic analysis with RAG",
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
                        "search_strategic_content (NEW)",
                    ],
                    endpoints: {
                        sse: "/sse",
                        mcp: "/mcp",
                        "ai/chat": "/ai/chat (POST) - AI assistant for team builder",
                        "api/feedback": "/api/feedback (POST) - Submit feedback",
                        "api/team/share": "/api/team/share (POST) - Create shared team link",
                        "api/team/:id": "/api/team/:id (GET) - Retrieve shared team",
                        "og/team/:id": "/og/team/:id (GET) - OG image for shared team",
                        "test-ingestion": "/test-ingestion",
                        "test-kv": "/test-kv",
                        "test-rag": "/test-rag?q=your+query",
                        "debug-vectors": "/debug-vectors",
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
        console.log(
            "Scheduled ingestion pipeline triggered at:",
            new Date(event.scheduledTime).toISOString(),
        );

        try {
            const stats = await runIngestionPipeline(env);
            console.log("Ingestion pipeline completed successfully:", stats);
        } catch (error) {
            console.error("Ingestion pipeline failed:", error);
        }
    },
};
