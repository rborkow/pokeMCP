/**
 * Admin API endpoints for usage monitoring dashboard
 *
 * Queries Cloudflare Analytics Engine via the REST API and returns
 * structured data for the admin dashboard. All endpoints are protected
 * by Cloudflare Access JWT validation.
 *
 * Analytics Engine data point schema (written by src/analytics.ts):
 *   Event types (indexes[0]): "tool_call", "ai_chat", "session"
 *   See analytics.ts for full blob/double slot mappings.
 */

// --- Cloudflare Access JWT validation ---

interface AccessJwtPayload {
    iss: string;
    sub: string;
    email?: string;
    exp: number;
    iat: number;
}

/**
 * Validate Cloudflare Access JWT from request headers.
 * Returns the decoded payload if valid, null otherwise.
 *
 * In production, this validates against the Access certs endpoint.
 * For local dev (no CF_ACCESS_TEAM_DOMAIN), it allows all requests.
 */
async function validateAccessJwt(request: Request, env: Env): Promise<AccessJwtPayload | null> {
    // Skip auth in development (no team domain configured)
    if (!env.CF_ACCESS_TEAM_DOMAIN) {
        const environment = (env as unknown as Record<string, unknown>).ENVIRONMENT;
        if (environment === "production") {
            console.error(
                "[Admin] CRITICAL: CF_ACCESS_TEAM_DOMAIN not set in production - denying access",
            );
            return null;
        }
        console.warn(
            "[Admin] Auth bypassed - CF_ACCESS_TEAM_DOMAIN not configured (dev/staging mode)",
        );
        return { iss: "dev", sub: "dev", email: "dev@localhost", exp: 0, iat: 0 };
    }

    const jwt =
        request.headers.get("Cf-Access-Jwt-Assertion") ||
        getCookieValue(request.headers.get("Cookie") || "", "CF_Authorization");

    if (!jwt) return null;

    try {
        // Fetch Access public keys
        const certsUrl = `https://${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`;
        const certsResponse = await fetch(certsUrl);
        if (!certsResponse.ok) return null;

        const certs = (await certsResponse.json()) as { keys: JsonWebKey[] };

        // Try each key to verify the JWT
        for (const jwk of certs.keys) {
            try {
                const key = await crypto.subtle.importKey(
                    "jwk",
                    jwk,
                    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
                    false,
                    ["verify"],
                );

                const parts = jwt.split(".");
                if (parts.length !== 3) continue;

                const header = parts[0];
                const payload = parts[1];
                const signature = parts[2];

                const data = new TextEncoder().encode(`${header}.${payload}`);
                const sig = base64UrlDecode(signature);

                const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, data);

                if (valid) {
                    const decoded = JSON.parse(atob(base64UrlToBase64(payload)));
                    // Check expiration
                    if (decoded.exp && decoded.exp < Date.now() / 1000) continue;
                    return decoded as AccessJwtPayload;
                }
            } catch {
                // Key didn't verify, try next
            }
        }
    } catch (error) {
        console.error("[Admin] JWT validation error:", error);
    }

    return null;
}

function getCookieValue(cookieHeader: string, name: string): string | null {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? match[1] : null;
}

function base64UrlToBase64(base64Url: string): string {
    return base64Url.replace(/-/g, "+").replace(/_/g, "/");
}

function base64UrlDecode(base64Url: string): ArrayBuffer {
    const base64 = base64UrlToBase64(base64Url);
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// --- Analytics Engine SQL queries ---

interface AnalyticsQueryResult {
    data: Record<string, unknown>[];
    rows: number;
}

async function queryAnalyticsEngine(
    env: Env,
    sql: string,
    retries = 3,
): Promise<AnalyticsQueryResult> {
    if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
        throw new Error("Analytics Engine credentials not configured");
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
                    "Content-Type": "text/plain",
                },
                body: sql,
            },
        );

        if (response.status === 429 && attempt < retries) {
            // Exponential backoff: 500ms, 1s, 2s
            const delay = 500 * 2 ** attempt;
            console.warn(`[Admin] Analytics Engine rate limited, retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Admin] Analytics Engine query failed:", response.status, errorText);

            // 422 typically means the dataset table doesn't exist yet (no data written)
            // Return empty results instead of erroring, but log for diagnostics
            if (response.status === 422) {
                console.error("[Admin] Analytics Engine 422:", errorText);
                return { data: [], rows: 0 };
            }

            throw new Error(`Analytics Engine query failed: ${response.status}`);
        }

        const result = (await response.json()) as {
            data: Record<string, unknown>[];
            rows: number;
        };
        return result;
    }

    throw new Error("Analytics Engine query failed: max retries exceeded");
}

function parseRange(range: string | null): string {
    switch (range) {
        case "1h":
            return "'1' HOUR";
        case "24h":
        case null:
            return "'24' HOUR";
        case "7d":
            return "'7' DAY";
        case "30d":
            return "'30' DAY";
        case "90d":
            return "'90' DAY";
        default:
            return "'24' HOUR";
    }
}

// --- Admin API handlers ---
//
// Column meanings are documented in analytics.ts. Counts use
// `_sample_interval` so they stay right if Analytics Engine samples the data.

const DATASET = '"pokemcp-analytics"';

/**
 * Run a query whose failure must not take the rest of a response with it.
 * Percentiles use a function the core queries do not, so they are fetched
 * separately and simply left out if that query is rejected.
 */
async function queryOptional(
    env: Env,
    sql: string,
): Promise<{ data: Record<string, unknown>[]; error?: string }> {
    try {
        const result = await queryAnalyticsEngine(env, sql);
        return { data: result.data };
    } catch (error) {
        return { data: [], error: error instanceof Error ? error.message : String(error) };
    }
}

async function handleOverview(env: Env, url: URL): Promise<Response> {
    const range = parseRange(url.searchParams.get("range"));

    // Serialize queries to avoid Analytics Engine rate limits
    const toolCalls = await queryAnalyticsEngine(
        env,
        `SELECT
            sum(_sample_interval) as total,
            sum(if(blob3 = '1', _sample_interval, 0)) as successes,
            sum(double1 * _sample_interval) / sum(_sample_interval) as avg_response_ms
        FROM ${DATASET}
        WHERE index1 = 'tool_call'
            AND timestamp > NOW() - INTERVAL ${range}`,
    );
    const sessions = await queryAnalyticsEngine(
        env,
        `SELECT
            sum(if(blob1 = 'connect', _sample_interval, 0)) as connections
        FROM ${DATASET}
        WHERE index1 = 'session'
            AND timestamp > NOW() - INTERVAL ${range}`,
    );
    const requests = await queryAnalyticsEngine(
        env,
        `SELECT
            sum(_sample_interval) as total,
            sum(if(blob2 != '200' AND blob2 != '202', _sample_interval, 0)) as errors,
            sum(if(blob2 = '429', _sample_interval, 0)) as rate_limited,
            sum(double1 * _sample_interval) / sum(_sample_interval) as avg_ms
        FROM ${DATASET}
        WHERE index1 = 'mcp_request'
            AND timestamp > NOW() - INTERVAL ${range}`,
    );
    const percentiles = await queryOptional(
        env,
        `SELECT
            quantileExactWeighted(0.5)(double1, _sample_interval) as p50_ms,
            quantileExactWeighted(0.95)(double1, _sample_interval) as p95_ms
        FROM ${DATASET}
        WHERE index1 = 'mcp_request'
            AND blob2 != '429'
            AND timestamp > NOW() - INTERVAL ${range}`,
    );

    return jsonResponse({
        range,
        toolCalls: toolCalls.data[0] || {},
        sessions: sessions.data[0] || {},
        requests: { ...(requests.data[0] || {}), ...(percentiles.data[0] || {}) },
        percentilesError: percentiles.error,
    });
}

async function handleUsage(env: Env, url: URL): Promise<Response> {
    const range = parseRange(url.searchParams.get("range"));
    const intervalParam = url.searchParams.get("interval") || "hour";
    const interval = intervalParam === "day" ? "day" : "hour";

    const bucketFn = interval === "day" ? "toStartOfDay(timestamp)" : "toStartOfHour(timestamp)";

    const result = await queryAnalyticsEngine(
        env,
        `SELECT
            ${bucketFn} as bucket,
            index1 as event_type,
            sum(_sample_interval) as count
        FROM ${DATASET}
        WHERE timestamp > NOW() - INTERVAL ${range}
            AND (index1 = 'tool_call' OR index1 = 'session')
        GROUP BY bucket, event_type
        ORDER BY bucket ASC`,
    );

    return jsonResponse({ range, interval, data: result.data });
}

async function handleTools(env: Env, url: URL): Promise<Response> {
    const range = parseRange(url.searchParams.get("range"));

    const result = await queryAnalyticsEngine(
        env,
        `SELECT
            blob1 as tool_name,
            sum(_sample_interval) as calls,
            sum(if(blob3 = '1', _sample_interval, 0)) as successes,
            sum(double1 * _sample_interval) / sum(_sample_interval) as avg_response_ms
        FROM ${DATASET}
        WHERE index1 = 'tool_call'
            AND timestamp > NOW() - INTERVAL ${range}
        GROUP BY tool_name
        ORDER BY calls DESC`,
    );
    const formats = await queryAnalyticsEngine(
        env,
        `SELECT
            blob2 as format,
            sum(_sample_interval) as calls
        FROM ${DATASET}
        WHERE index1 = 'tool_call'
            AND timestamp > NOW() - INTERVAL ${range}
        GROUP BY format
        ORDER BY calls DESC`,
    );

    return jsonResponse({ range, tools: result.data, formats: formats.data });
}

/** Who is connecting: which assistant, and what its client calls itself. */
async function handleClients(env: Env, url: URL): Promise<Response> {
    const range = parseRange(url.searchParams.get("range"));

    const connections = await queryAnalyticsEngine(
        env,
        `SELECT
            blob7 as client,
            blob5 as client_name,
            blob8 as user_agent,
            sum(_sample_interval) as connections
        FROM ${DATASET}
        WHERE index1 = 'session'
            AND blob1 = 'connect'
            AND timestamp > NOW() - INTERVAL ${range}
        GROUP BY client, client_name, user_agent
        ORDER BY connections DESC
        LIMIT 50`,
    );
    const toolCalls = await queryAnalyticsEngine(
        env,
        `SELECT
            blob6 as client,
            sum(_sample_interval) as calls
        FROM ${DATASET}
        WHERE index1 = 'tool_call'
            AND timestamp > NOW() - INTERVAL ${range}
        GROUP BY client
        ORDER BY calls DESC`,
    );

    return jsonResponse({ range, connections: connections.data, toolCalls: toolCalls.data });
}

/** How the endpoint is performing: every request by kind, with errors and latency. */
async function handlePerformance(env: Env, url: URL): Promise<Response> {
    const range = parseRange(url.searchParams.get("range"));

    const requests = await queryAnalyticsEngine(
        env,
        `SELECT
            blob1 as kind,
            sum(_sample_interval) as requests,
            sum(if(blob2 != '200' AND blob2 != '202', _sample_interval, 0)) as errors,
            sum(double1 * _sample_interval) / sum(_sample_interval) as avg_ms
        FROM ${DATASET}
        WHERE index1 = 'mcp_request'
            AND timestamp > NOW() - INTERVAL ${range}
        GROUP BY kind
        ORDER BY requests DESC`,
    );
    const percentiles = await queryOptional(
        env,
        `SELECT
            blob1 as kind,
            quantileExactWeighted(0.5)(double1, _sample_interval) as p50_ms,
            quantileExactWeighted(0.95)(double1, _sample_interval) as p95_ms
        FROM ${DATASET}
        WHERE index1 = 'mcp_request'
            AND timestamp > NOW() - INTERVAL ${range}
        GROUP BY kind`,
    );
    const statuses = await queryAnalyticsEngine(
        env,
        `SELECT
            blob2 as status,
            sum(_sample_interval) as requests
        FROM ${DATASET}
        WHERE index1 = 'mcp_request'
            AND timestamp > NOW() - INTERVAL ${range}
        GROUP BY status
        ORDER BY requests DESC`,
    );

    const byKind = new Map(percentiles.data.map((row) => [row.kind, row]));
    return jsonResponse({
        range,
        requests: requests.data.map((row) => ({ ...row, ...(byKind.get(row.kind) || {}) })),
        statuses: statuses.data,
        percentilesError: percentiles.error,
    });
}

// --- Diagnostics endpoint ---

async function handleDiagnostics(env: Env): Promise<Response> {
    const diagnostics: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        bindings: {
            ANALYTICS: !!env.ANALYTICS,
            CLOUDFLARE_API_TOKEN: !!env.CLOUDFLARE_API_TOKEN,
            CLOUDFLARE_ACCOUNT_ID: !!env.CLOUDFLARE_ACCOUNT_ID,
            CF_ACCESS_TEAM_DOMAIN: !!env.CF_ACCESS_TEAM_DOMAIN,
        },
        environment: (env as unknown as Record<string, unknown>).ENVIRONMENT ?? "unknown",
    };

    // Test write path
    if (env.ANALYTICS) {
        try {
            env.ANALYTICS.writeDataPoint({
                indexes: ["diagnostic"],
                blobs: ["test", new Date().toISOString()],
                doubles: [1],
            });
            diagnostics.writeTest = { success: true };
        } catch (error) {
            diagnostics.writeTest = {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    } else {
        diagnostics.writeTest = { success: false, error: "ANALYTICS binding missing" };
    }

    // Test read path — raw HTTP response, not the swallowed version
    if (env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
        try {
            const response = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
                        "Content-Type": "text/plain",
                    },
                    body: "SELECT count() as total FROM \"pokemcp-analytics\" WHERE timestamp > NOW() - INTERVAL '1' HOUR",
                },
            );
            const body = await response.text();
            diagnostics.readTest = {
                status: response.status,
                body: body.substring(0, 500),
            };
        } catch (error) {
            diagnostics.readTest = {
                status: 0,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    } else {
        diagnostics.readTest = {
            status: 0,
            error: "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID",
        };
    }

    return jsonResponse(diagnostics);
}

// --- Request router ---

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=30",
        },
    });
}

/**
 * Main admin request handler. Called from index.ts for /admin/* routes.
 */
export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Cf-Access-Jwt-Assertion, Cookie",
                "Access-Control-Max-Age": "86400",
            },
        });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace("/admin/api/", "").replace(/\/$/, "");

    // All admin endpoints require Cloudflare Access JWT
    const jwtPayload = await validateAccessJwt(request, env);
    if (!jwtPayload) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    try {
        switch (path) {
            case "overview":
                return await handleOverview(env, url);
            case "usage":
                return await handleUsage(env, url);
            case "tools":
                return await handleTools(env, url);
            case "clients":
                return await handleClients(env, url);
            case "performance":
                return await handlePerformance(env, url);
            case "diagnostics":
                return await handleDiagnostics(env);
            default:
                return jsonResponse({ error: "Not found", path }, 404);
        }
    } catch (error) {
        console.error("[Admin] Request error:", error);
        return jsonResponse(
            {
                error: "Internal server error",
                details: error instanceof Error ? error.message : String(error),
            },
            500,
        );
    }
}
