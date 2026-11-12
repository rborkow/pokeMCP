/**
 * Usage recording for the connector, written to Workers Analytics Engine
 * (dataset `pokemcp-analytics`) and read back by the admin API (admin.ts).
 *
 * Nothing here identifies a person, and no tool arguments or results are
 * recorded: only which tool, which format, whether it worked, how long it
 * took, and which assistant software made the request.
 *
 * Each event type is one value of `index1`. Column positions are part of the
 * stored data, so add new columns at the end and never reuse a position.
 *
 *   tool_call     blob1 tool, blob2 format, blob3 "1"/"0" success,
 *                 blob4 (was a per-session id; always empty now), blob5 "mcp",
 *                 blob6 client family; double1 duration in ms
 *   session       blob1 "connect", blob2 random id, blob3 "mcp", blob4 "mcp",
 *                 blob5 reported client name, blob6 reported client version,
 *                 blob7 client family, blob8 User-Agent product
 *   mcp_request   blob1 kind of request, blob2 HTTP status, blob3 client
 *                 family; double1 duration in ms
 *
 * Rows written before November 2026 also include `ai_chat` events and
 * `tool_call` rows with other values in blob5; nothing writes those any more.
 */
import type { ClientFamily } from "./connector/client.js";

/** Valid source tags for tracking */
export type TrackingSource = "web" | "mcp" | "rest";

function dataset(env: Env, event: string): AnalyticsEngineDataset | null {
    if (!env.ANALYTICS) {
        console.warn(`[Analytics] SKIP ${event}: ANALYTICS binding missing`);
        return null;
    }
    return env.ANALYTICS;
}

/** Record one tool call. Fire-and-forget: writeDataPoint does not block. */
export function trackToolCall(
    env: Env,
    toolName: string,
    format: string | undefined,
    success: boolean,
    responseTimeMs: number,
    sessionId?: string,
    source?: TrackingSource,
    client?: ClientFamily,
): void {
    dataset(env, "tool_call")?.writeDataPoint({
        indexes: ["tool_call"],
        blobs: [
            toolName,
            format ?? "",
            success ? "1" : "0",
            sessionId ?? "",
            source ?? "",
            client ?? "",
        ],
        doubles: [responseTimeMs],
    });
}

/** Record a client opening a connection (an MCP `initialize`). */
export function trackConnection(
    env: Env,
    client: { name: string; version: string; family: ClientFamily; userAgentProduct: string },
): void {
    dataset(env, "session")?.writeDataPoint({
        indexes: ["session"],
        blobs: [
            "connect",
            // Random, never sent to the client and never reused: it only keeps
            // each connection a separate row.
            crypto.randomUUID(),
            "mcp",
            "mcp",
            client.name,
            client.version,
            client.family,
            client.userAgentProduct,
        ],
        doubles: [],
    });
}

/** Record one request to the MCP endpoint: what kind, how it ended, how long it took. */
export function trackMcpRequest(
    env: Env,
    request: { kind: string; status: number; durationMs: number; client: ClientFamily },
): void {
    dataset(env, "mcp_request")?.writeDataPoint({
        indexes: ["mcp_request"],
        blobs: [request.kind, String(request.status), request.client],
        doubles: [request.durationMs],
    });
}

/**
 * Session lifecycle event from the retired per-session Durable Object. Kept
 * only while that class still exists; nothing calls it for live traffic.
 */
export function trackSession(
    env: Env,
    action: "connect" | "disconnect",
    sessionId: string,
    transport: "sse" | "mcp" | "rest",
    source?: TrackingSource,
): void {
    dataset(env, "session")?.writeDataPoint({
        indexes: ["session"],
        blobs: [action, sessionId, transport, source ?? ""],
        doubles: [],
    });
}
