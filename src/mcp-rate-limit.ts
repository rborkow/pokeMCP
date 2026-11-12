/**
 * Abuse ceiling for the public, unauthenticated MCP endpoint.
 *
 * Keyed by client IP using the Workers Rate Limiting binding (counters are
 * kept per Cloudflare location, with no storage writes). The limit in
 * wrangler.jsonc is deliberately generous: assistants such as Claude and
 * ChatGPT call connectors from shared egress addresses, so one IP can carry
 * many people's conversations. It exists to stop a single client hammering
 * the endpoint, not to meter normal use.
 */
export interface RateLimiter {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Returns a 429 response when the caller is over the limit, otherwise null.
 *
 * Fails open: a missing binding (local dev, a misconfigured environment) or a
 * limiter error must not take the connector down.
 */
export async function mcpRateLimitResponse(
    request: Request,
    limiter: RateLimiter | undefined,
): Promise<Response | null> {
    // CORS preflights carry no work and are not counted.
    if (!limiter || request.method === "OPTIONS") return null;

    const key = request.headers.get("CF-Connecting-IP") ?? "unknown";
    try {
        const { success } = await limiter.limit({ key });
        if (success) return null;
    } catch (error) {
        console.error("MCP rate limiter failed; allowing the request:", error);
        return null;
    }

    return new Response(
        JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Too many requests. Please retry in a minute." },
            id: null,
        }),
        {
            status: 429,
            headers: {
                "Content-Type": "application/json",
                "Retry-After": "60",
                "Access-Control-Allow-Origin": "*",
            },
        },
    );
}
