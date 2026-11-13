import { EmailMessage } from "cloudflare:email";
import { DurableObject } from "cloudflare:workers";
import { createMimeMessage } from "mimetext/browser";
import { handleAdminRequest } from "./admin.js";
import { CONNECTOR_INFO } from "./connector/tools.js";
import { getOpenAiChallengeResponse } from "./domain-verification.js";
import { getFaviconResponse } from "./favicon.js";
import { mcpRateLimitResponse } from "./mcp-rate-limit.js";
import { recordRateLimited, serveMcp } from "./mcp-usage.js";
import { getRetirementResponse } from "./retirement.js";
import {
    checkRateLimit,
    getSharedTeam,
    refreshSharedTeamTtl,
    storeSharedTeam,
    validateTeamForSharing,
} from "./share.js";
import { refreshTournamentNewsroom } from "./tournaments/ingestion.js";

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

/**
 * Retired. This Durable Object used to run the weekly Smogon-analysis
 * ingestion, which fed a strategy-search tool that no longer exists. Nothing
 * creates or calls it now.
 *
 * The class stays exported because Cloudflare requires every Durable Object
 * class named in an applied migration (`v2` in wrangler.jsonc) to exist until
 * a `deleted_classes` migration removes it. Deleting it properly is a
 * separate, deliberate deploy. The alarm handler only clears any state left
 * from a run that was in progress when this was deployed.
 */
export class IngestionCoordinator extends DurableObject<Env> {
    async alarm() {
        await this.ctx.storage.deleteAll();
    }
}

/**
 * Retired. `/mcp` used to create one of these per client session; it has been
 * answered statelessly by the Worker (connector/http.ts) since November 2026.
 * The class stays only because an applied migration names it; removing it
 * needs a `deleted_classes` migration.
 */
export class PokemonMCP extends DurableObject<Env> {
    // The old class scheduled alarms; one left behind clears the object's storage.
    async alarm() {
        await this.ctx.storage.deleteAll();
    }
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        const retirementResponse = getRetirementResponse(url.pathname, request.method);
        if (retirementResponse) return retirementResponse;

        const faviconResponse = getFaviconResponse(url.pathname, request.method);
        if (faviconResponse) return faviconResponse;

        const challengeResponse = getOpenAiChallengeResponse(
            url.pathname,
            request.method,
            env.OPENAI_APPS_CHALLENGE,
        );
        if (challengeResponse) return challengeResponse;

        // Public MCP endpoint (Streamable HTTP). Deliberately not gated by the
        // browser origin allowlist below: MCP clients such as Claude and
        // ChatGPT connect from their own infrastructure.
        if (url.pathname === "/mcp") {
            const rateLimited = await mcpRateLimitResponse(request, env.MCP_RATE_LIMITER);
            if (rateLimited) {
                recordRateLimited(request, env);
                return rateLimited;
            }
            // Served statelessly in this Worker (connector/http.ts), with
            // usage recording around it (mcp-usage.ts).
            return serveMcp(request, env);
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

        // Liveness for post-deploy verification. The worker calls no AI
        // provider and needs no gateway secrets, so there is nothing to report
        // beyond being up.
        if (url.pathname === "/health") {
            return new Response(JSON.stringify({ environment: env.ENVIRONMENT ?? "unknown" }), {
                headers: {
                    ...getCorsHeaders(request),
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store",
                },
            });
        }

        // Root endpoint - return server info
        if (url.pathname === "/") {
            return new Response(
                JSON.stringify({
                    name: CONNECTOR_INFO.title,
                    description:
                        "Read-only MCP server for competitive Pokémon VGC team building. " +
                        "Unofficial fan project; not affiliated with Nintendo, Creatures Inc., " +
                        "GAME FREAK inc. or The Pokémon Company.",
                    website: CONNECTOR_INFO.websiteUrl,
                    documentation: "https://docs.pokemcp.com",
                    endpoints: {
                        mcp: "/mcp (POST) - MCP over Streamable HTTP",
                        health: "/health (GET) - Liveness",
                        "favicon.ico": "/favicon.ico, /favicon.svg (GET) - Connector icon",
                        "api/feedback": "/api/feedback (POST) - Submit feedback",
                        "api/team/:id": "/api/team/:id (GET) - Read a legacy shared team",
                        "og/team/:id": "/og/team/:id (GET) - OG image for shared team",
                        "admin/api/overview":
                            "/admin/api/overview (GET) - Usage overview (protected)",
                        "admin/api/usage": "/admin/api/usage (GET) - Time-series usage (protected)",
                        "admin/api/tools": "/admin/api/tools (GET) - Tool metrics (protected)",
                        "admin/api/clients":
                            "/admin/api/clients (GET) - Connections by assistant (protected)",
                        "admin/api/performance":
                            "/admin/api/performance (GET) - Requests, errors and latency (protected)",
                    },
                }),
                {
                    headers: { "Content-Type": "application/json" },
                },
            );
        }

        return new Response("Not found", { status: 404 });
    },

    // One schedule: the daily tournament refresh (06:00 UTC).
    async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
        try {
            await refreshTournamentNewsroom(env);
        } catch (error) {
            console.error(
                JSON.stringify({
                    event: "tournament_ingestion_failed",
                    message: error instanceof Error ? error.message : "unknown",
                }),
            );
            // Rethrow so the cron run is marked failed in Cloudflare observability.
            throw error;
        }
    },
};
