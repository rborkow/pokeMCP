/**
 * The MCP endpoint with usage recording around it.
 *
 * Records, for every request, what kind it was, how it ended and how long it
 * took; for every connection, which assistant software opened it; and for
 * every tool call, the tool, format, outcome and duration. See analytics.ts
 * for exactly what is stored. Imports nothing Workers-only, so it runs under
 * `node --test` with a stand-in for the Analytics Engine binding.
 */
import { trackConnection, trackMcpRequest, trackToolCall } from "./analytics.js";
import { classifyClient, cleanClientLabel, userAgentProduct } from "./connector/client.js";
import { handleMcpRequest } from "./connector/http.js";

export async function serveMcp(request: Request, env: Env): Promise<Response> {
    const started = Date.now();
    const userAgent = request.headers.get("User-Agent");
    // Tool calls carry no client name, so those are attributed by User-Agent.
    // A connection also has the name the client reports, which is more reliable.
    let client = classifyClient(null, userAgent);
    let kind = request.method === "POST" ? "unread" : `http_${request.method.toLowerCase()}`;

    let response: Response;
    try {
        response = await handleMcpRequest(request, env, {
            onRequestKind: (requestKind) => {
                kind = requestKind;
            },
            onInitialize: (info) => {
                client = classifyClient(info.name, userAgent);
                trackConnection(env, {
                    name: cleanClientLabel(info.name),
                    version: cleanClientLabel(info.version),
                    family: client,
                    userAgentProduct: userAgentProduct(userAgent),
                });
            },
            onCall: (call) =>
                trackToolCall(
                    env,
                    call.tool,
                    call.format,
                    call.success,
                    call.durationMs,
                    undefined,
                    "mcp",
                    client,
                ),
        });
    } catch (error) {
        console.error("MCP request failed:", error);
        response = new Response(
            JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal error. Please try again." },
                id: null,
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }

    // Browser preflights carry no work and would only add noise.
    if (request.method !== "OPTIONS") {
        trackMcpRequest(env, {
            kind,
            status: response.status,
            durationMs: Date.now() - started,
            client,
        });
    }
    return response;
}

/** Record a request that was turned away by the rate limit before it was handled. */
export function recordRateLimited(request: Request, env: Env): void {
    trackMcpRequest(env, {
        kind: "rate_limited",
        status: 429,
        durationMs: 0,
        client: classifyClient(null, request.headers.get("User-Agent")),
    });
}
