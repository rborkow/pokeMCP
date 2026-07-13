import { toNextJsHandler } from "better-auth/next-js";
import { AuthUnavailableError, getAuth, getPrepCloudflareEnv } from "@/lib/auth";

async function authRateLimit(request: Request) {
    if (request.method === "GET" || request.method === "HEAD") return null;

    const env = getPrepCloudflareEnv();
    if (!env.PREP_RATE_LIMITER || !env.BETTER_AUTH_SECRET) return null;

    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(env.BETTER_AUTH_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
    const privacySafeIpHash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
    ).join("");
    const { success } = await env.PREP_RATE_LIMITER.limit({
        key: `auth:${privacySafeIpHash}`,
    });

    return success
        ? null
        : Response.json(
              { error: "Too many authentication requests. Please try again shortly." },
              { status: 429, headers: { "Retry-After": "60" } },
          );
}

async function authHandler(request: Request) {
    try {
        const rateLimitResponse = await authRateLimit(request);
        if (rateLimitResponse) return rateLimitResponse;
        return await getAuth().handler(request);
    } catch (error) {
        if (error instanceof AuthUnavailableError) {
            return Response.json({ error: error.message }, { status: 503 });
        }
        console.error(
            JSON.stringify({
                event: "auth_handler_error",
                message: error instanceof Error ? error.message : "unknown",
            }),
        );
        return Response.json({ error: "Authentication is unavailable." }, { status: 500 });
    }
}

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(authHandler);
