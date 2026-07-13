import { EmailMessage } from "cloudflare:email";
import { WorkerEntrypoint } from "cloudflare:workers";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { createMimeMessage } from "mimetext/browser";
import { z } from "zod";
import { handleAdminRequest } from "./admin.js";
import { trackSession, trackToolCall } from "./analytics.js";
import { getIngestionFormats } from "./ingestion/orchestrator.js";
import { withLogging } from "./logging.js";
import {
    checkRateLimit,
    checkRateLimitGeneric,
    getSharedTeam,
    refreshSharedTeamTtl,
    storeSharedTeam,
    validateTeamForSharing,
} from "./share.js";
import { TOOL_REGISTRY } from "./tool-registry.js";
import { getRetirementResponse } from "./retirement.js";
import { refreshTournamentNewsroom } from "./tournaments/ingestion.js";

// One-time per-isolate log of gateway secret presence. Lets us verify
// secret deployment via `wrangler tail` without exposing values.
let gatewayHealthLogged = false;
function logGatewayHealthOnce(env: Env): void {
    if (gatewayHealthLogged) return;
    gatewayHealthLogged = true;
    console.log(
        JSON.stringify({
            event: "ai_gateway_health",
            source: "mcp-worker",
            environment: env.ENVIRONMENT ?? "unknown",
            gateway: {
                ai_gateway_id: Boolean(env.AI_GATEWAY_ID),
            },
        }),
    );
}

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
        "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
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

// Durable Object that runs the weekly RAG ingestion as an alarm chain
// (one format slice per alarm). Re-exported so wrangler can bind it.
export { IngestionCoordinator } from "./ingestion/coordinator.js";

// Define our Pokemon MCP agent with tools
export class PokemonMCP extends McpAgent {
    server = new McpServer({
        name: "Pokemon MCP Server",
        version: "0.3.0",
    });

    // Privacy-safe session ID — random per DO instance, not tied to any user
    sessionId = crypto.randomUUID();

    async init() {
        const env = this.env as Env;

        // Track session connection
        trackSession(env, "connect", this.sessionId, "mcp", "mcp");

        for (const tool of TOOL_REGISTRY) {
            this.server.tool(tool.name, tool.schema, async (args) => {
                const startTime = performance.now();
                let success = true;
                let text: string;
                try {
                    text = await withLogging(env, tool.name, args, () => tool.execute(args, env));
                } catch (error) {
                    success = false;
                    throw error;
                } finally {
                    const responseTimeMs = Math.round(performance.now() - startTime);
                    const format = typeof args.format === "string" ? args.format : undefined;
                    trackToolCall(
                        env,
                        tool.name,
                        format,
                        success,
                        responseTimeMs,
                        this.sessionId,
                        "mcp",
                    );
                }
                return { content: [{ type: "text", text }] };
            });
        }
    }

    async destroy() {
        const env = this.env as Env;
        trackSession(env, "disconnect", this.sessionId, "mcp", "mcp");
    }
}

/**
 * Private, typed service-binding entrypoint used by PokeMCP Prep. It is
 * deployed with the Worker but has no public HTTP route.
 */
export class PrepAnalysisService extends WorkerEntrypoint<Env> {
    async runTool(toolName: string, args: Record<string, unknown>): Promise<string> {
        const tool = TOOL_REGISTRY.find((candidate) => candidate.name === toolName);
        if (!tool) throw new Error(`Unknown internal tool: ${toolName}`);
        const parsed = z.object(tool.schema).safeParse(args);
        if (!parsed.success) throw new Error(`Invalid arguments for internal tool: ${toolName}`);
        return tool.execute(parsed.data, this.env);
    }

    async capabilities() {
        return TOOL_REGISTRY.map(({ name, description }) => ({ name, description }));
    }
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        const retirementResponse = getRetirementResponse(url.pathname, request.method);
        if (retirementResponse) return retirementResponse;

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

            // Rate limit: 30 requests per minute per IP
            const toolsIp = request.headers.get("CF-Connecting-IP") || "unknown";
            const toolsAllowed = await checkRateLimitGeneric(
                env.POKEMON_STATS,
                "tools",
                toolsIp,
                30,
                60,
            );
            if (!toolsAllowed) {
                return new Response(
                    JSON.stringify({ error: "Rate limited. Please try again later." }),
                    { status: 429, headers: corsHeaders },
                );
            }

            // Use client-provided session ID to group tool calls from the same conversation
            const restSessionId = request.headers.get("X-Session-Id") || crypto.randomUUID();
            trackSession(env, "connect", restSessionId, "rest", "rest");

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

                const restStartTime = performance.now();
                let restSuccess = true;
                let result: string;
                try {
                    result = await withLogging(
                        env,
                        tool,
                        args,
                        () => toolDef.execute(args, env),
                        undefined,
                        ctx,
                    );
                } catch (error) {
                    restSuccess = false;
                    throw error;
                } finally {
                    const restResponseTime = Math.round(performance.now() - restStartTime);
                    const restFormat = typeof args?.format === "string" ? args.format : undefined;
                    trackToolCall(
                        env,
                        tool,
                        restFormat,
                        restSuccess,
                        restResponseTime,
                        restSessionId,
                        "rest",
                    );
                }

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

        // Admin dashboard API endpoints
        if (url.pathname.startsWith("/admin/")) {
            return handleAdminRequest(request, env);
        }

        // Deploy health: secret-presence booleans for post-deploy verification.
        // Never returns secret values — only whether each env var is populated.
        if (url.pathname === "/health") {
            logGatewayHealthOnce(env);
            return new Response(
                JSON.stringify({
                    environment: env.ENVIRONMENT ?? "unknown",
                    gateway: {
                        ai_gateway_id: Boolean(env.AI_GATEWAY_ID),
                    },
                }),
                {
                    headers: {
                        ...getCorsHeaders(request),
                        "Content-Type": "application/json",
                        "Cache-Control": "no-store",
                    },
                },
            );
        }

        // Root endpoint - return server info
        if (url.pathname === "/") {
            return new Response(
                JSON.stringify({
                    name: "PokeMCP Prep analysis service",
                    status: "internal-only",
                    description: "The former public MCP product has been retired.",
                    product: "https://www.pokemcp.com",
                    endpoints: {
                        health: "/health (GET) - Deploy health / secret-presence booleans",
                        "api/feedback": "/api/feedback (POST) - Submit feedback",
                        "api/team/:id": "/api/team/:id (GET) - Read a legacy shared team",
                        "og/team/:id": "/og/team/:id (GET) - OG image for shared team",
                        "admin/api/overview":
                            "/admin/api/overview (GET) - Usage overview (protected)",
                        "admin/api/usage": "/admin/api/usage (GET) - Time-series usage (protected)",
                        "admin/api/costs": "/admin/api/costs (GET) - AI cost breakdown (protected)",
                        "admin/api/tools": "/admin/api/tools (GET) - Tool metrics (protected)",
                        "admin/api/sessions":
                            "/admin/api/sessions (GET) - Session list (protected)",
                    },
                }),
                {
                    headers: { "Content-Type": "application/json" },
                },
            );
        }

        return new Response("Not found", { status: 404 });
    },

    async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
        if (event.cron === "0 6 * * *") {
            try {
                await refreshTournamentNewsroom(env);
                return;
            } catch (error) {
                console.error(
                    JSON.stringify({
                        event: "tournament_ingestion_failed",
                        message: error instanceof Error ? error.message : "unknown",
                    }),
                );
                throw error;
            }
        }

        console.log(
            "Scheduled ingestion trigger fired at:",
            new Date(event.scheduledTime).toISOString(),
        );

        try {
            // Build the format list here; the IngestionCoordinator Durable Object
            // works through it one alarm at a time so each format gets a fresh
            // subrequest/CPU budget instead of dying inside this single invocation.
            const formats = await getIngestionFormats(env);
            const stub = env.INGESTION_COORDINATOR.get(
                env.INGESTION_COORDINATOR.idFromName("weekly-ingestion"),
            );
            await stub.seed(formats);
            console.log(`Seeded ingestion coordinator with ${formats.length} formats`);
        } catch (error) {
            console.error("Failed to seed ingestion coordinator:", error);
            // Rethrow so the cron invocation is marked failed in Cloudflare observability.
            throw error;
        }
    },
};
