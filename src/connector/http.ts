/**
 * The connector's HTTP endpoint: MCP over Streamable HTTP, served statelessly.
 *
 * Every tool only reads data and returns at once, so nothing has to be
 * remembered between requests. Each POST gets its own MCP server, answers with
 * plain JSON, and is finished. There is no session and no Durable Object.
 *
 * Two protocol eras are served on the same endpoint:
 *
 * - **2026-07-28** (the current MCP revision): no handshake and no sessions;
 *   every request carries its protocol version and client details in `_meta`
 *   and the `MCP-Protocol-Version` / `Mcp-Method` / `Mcp-Name` headers. The
 *   SDK's `createMcpHandler` answers these, including `server/discover`,
 *   header validation and the per-result `resultType`, `serverInfo` and cache
 *   fields.
 * - **2025-era** (2025-11-25 and earlier): the `initialize` handshake, served
 *   statelessly. No `Mcp-Session-Id` is issued, and one sent by an older client
 *   is ignored, so those clients keep working.
 *
 * `isLegacyRequest` (the SDK's own routing rule) decides which era a request
 * belongs to. `GET` (a server-to-client event stream) and `DELETE` (ending a
 * session) have nothing to act on and return 405, as the specification allows.
 *
 * Like the rest of `connector/`, this file imports nothing Workers-only, so it
 * runs under `node --test`.
 */
import {
    CLIENT_INFO_META_KEY,
    createMcpHandler,
    isLegacyRequest,
    McpServer,
    WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server";
import { type ConnectorCallInfo, registerConnectorTools } from "./register.js";
import { CONNECTOR_INFO, CONNECTOR_INSTRUCTIONS } from "./tools.js";

/** The client software named in an `initialize` request. */
export interface McpClientInfo {
    name?: string;
    version?: string;
}

export interface McpRequestHooks {
    /** Called once for each tool call, with operational metrics only. */
    onCall?: (info: ConnectorCallInfo) => void;
    /**
     * Called when a client opens a connection: a 2025-era `initialize`, or a
     * 2026-07-28 `server/discover` probe. Clients on the current revision may
     * skip the probe, so this undercounts them; `onClientInfo` still names them.
     */
    onInitialize?: (client: McpClientInfo) => void;
    /**
     * Called for a 2026-07-28 request that names its client in `_meta`, which
     * clients on that revision send with every request.
     */
    onClientInfo?: (client: McpClientInfo) => void;
    /**
     * Called once a POST body has been read, with the kind of request it is:
     * a JSON-RPC method such as `tools/call`, or `notification`, `batch`,
     * `invalid` (not JSON) or `other`.
     */
    onRequestKind?: (kind: string) => void;
}

// MCP clients such as Claude and ChatGPT connect from their own servers, and
// browser-based clients from any origin, so the endpoint is open to all.
const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // mcp-method and mcp-name are required on 2026-07-28 requests;
    // mcp-session-id is still sent by 2025-era clients and ignored.
    "Access-Control-Allow-Headers":
        "Content-Type, Accept, Authorization, mcp-protocol-version, mcp-method, mcp-name, mcp-session-id",
    "Access-Control-Max-Age": "86400",
};

/**
 * Limits on one POST. The per-IP rate limit counts requests, so without these
 * a single request could carry an unlimited amount of work.
 *
 * The largest legitimate body is a `validate_team` call for six Pokémon, a few
 * kilobytes. JSON-RPC batches were dropped from MCP in the 2025-06-18 revision
 * but earlier clients may still send small ones.
 */
export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_BATCH_MESSAGES = 10;

function jsonRpcError(status: number, code: number, message: string): Response {
    return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}

/** Read the request body, or return null as soon as it exceeds `maxBytes`. */
async function readBody(request: Request, maxBytes: number): Promise<string | null> {
    const declared = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(declared) && declared > maxBytes) return null;
    if (!request.body) return "";

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => {});
            return null;
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
}

function withCors(response: Response): Response {
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

function methodNotAllowed(): Response {
    return new Response(
        JSON.stringify({
            jsonrpc: "2.0",
            error: {
                code: -32000,
                message: "Method not allowed. This server is stateless: send MCP requests by POST.",
            },
            id: null,
        }),
        {
            status: 405,
            headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json",
                Allow: "POST, OPTIONS",
            },
        },
    );
}

function clientInfoFrom(info: unknown): McpClientInfo {
    const { name, version } = (info ?? {}) as { name?: unknown; version?: unknown };
    return {
        name: typeof name === "string" ? name : undefined,
        version: typeof version === "string" ? version : undefined,
    };
}

interface ClientMentions {
    /** The client of an `initialize` or `server/discover` message: a new connection. */
    connection: McpClientInfo | null;
    /** The client a 2026-07-28 request names in its `_meta`. */
    perRequest: McpClientInfo | null;
}

/** Where a parsed request body names its client, if anywhere. */
function findClient(body: unknown): ClientMentions {
    const found: ClientMentions = { connection: null, perRequest: null };
    const messages = Array.isArray(body) ? body : [body];
    for (const message of messages) {
        if (!message || typeof message !== "object") continue;
        const { method, params } = message as { method?: unknown; params?: unknown };
        const p = (params ?? {}) as { clientInfo?: unknown; _meta?: Record<string, unknown> };
        const metaInfo = p._meta?.[CLIENT_INFO_META_KEY];
        if (method === "initialize" && !found.connection) {
            found.connection = clientInfoFrom(p.clientInfo);
        }
        if (metaInfo && typeof metaInfo === "object") {
            found.perRequest ??= clientInfoFrom(metaInfo);
            if (method === "server/discover") found.connection ??= clientInfoFrom(metaInfo);
        }
    }
    return found;
}

// Methods worth telling apart in usage reports; anything else is "other" so a
// client cannot fill the report with made-up names.
const REPORTED_METHODS = new Set([
    "initialize",
    "server/discover",
    "tools/list",
    "tools/call",
    "ping",
]);

/** The kind of request a parsed body is, for usage reporting. */
function requestKind(body: unknown): string {
    if (Array.isArray(body)) return "batch";
    if (!body || typeof body !== "object") return "other";
    const { method, id } = body as { method?: unknown; id?: unknown };
    if (typeof method !== "string") return "other";
    if (id === undefined) return "notification";
    return REPORTED_METHODS.has(method) ? method : "other";
}

/**
 * How long a client or shared cache may reuse a `tools/list` or
 * `server/discover` result on the 2026-07-28 revision. Tools change only on a
 * deploy, and a tool's description names the default regulation, which moves
 * when new monthly statistics are uploaded; an hour bounds how stale either
 * can be. Both results are the same for every caller, so shared caches may
 * keep them.
 */
export const LIST_CACHE_TTL_MS = 60 * 60 * 1000;

/** A fresh MCP server with the connector's tools, for one request. */
function buildServer(env: Env, onCall: McpRequestHooks["onCall"]): McpServer {
    const cacheHint = { ttlMs: LIST_CACHE_TTL_MS, cacheScope: "public" as const };
    const server = new McpServer(CONNECTOR_INFO, {
        instructions: CONNECTOR_INSTRUCTIONS,
        // A stateless server can never send a list-changed notification, so it
        // does not offer one (the SDK would otherwise advertise it).
        capabilities: { tools: { listChanged: false } },
        cacheHints: { "tools/list": cacheHint, "server/discover": cacheHint },
    });
    registerConnectorTools(server, env, onCall);
    return server;
}

/** Answer a 2025-era request: stateless, with a plain JSON reply. */
async function serveLegacy(
    request: Request,
    parsedBody: unknown,
    parsed: boolean,
    env: Env,
    hooks: McpRequestHooks,
): Promise<Response> {
    // A stateless transport cannot be shared: a fresh server and transport per
    // request keeps one client's message ids from colliding with another's.
    const server = buildServer(env, hooks.onCall);
    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });
    try {
        await server.connect(transport);
        return await transport.handleRequest(request, parsed ? { parsedBody } : undefined);
    } finally {
        // The JSON response is complete by now; release the server's handlers.
        await server.close().catch(() => {});
    }
}

/** Answer a 2026-07-28 request through the SDK's handler for that revision. */
async function serveModern(
    request: Request,
    parsedBody: unknown,
    parsed: boolean,
    env: Env,
    hooks: McpRequestHooks,
): Promise<Response> {
    const handler = createMcpHandler(() => buildServer(env, hooks.onCall), {
        // 2025-era traffic never reaches this handler; it is routed above.
        legacy: "reject",
        // "auto" answers with plain JSON unless a handler emits a message before
        // its result, which these tools never do. ("json" would do the same but
        // logs a warning on every request.)
        responseMode: "auto",
        onerror: (error) => console.error("MCP request rejected:", error.message),
    });
    try {
        return await handler.fetch(request, parsed ? { parsedBody } : undefined);
    } finally {
        await handler.close().catch(() => {});
    }
}

/** Answer one request to the MCP endpoint. */
export async function handleMcpRequest(
    request: Request,
    env: Env,
    hooks: McpRequestHooks = {},
): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (request.method !== "POST") return methodNotAllowed();

    // Read the body once, under the size limit: to notice who the client is,
    // and to hand the SDK the parsed message. Invalid JSON is passed through
    // untouched so the SDK reports it the standard way.
    const raw = await readBody(request, MAX_BODY_BYTES);
    if (raw === null) {
        return jsonRpcError(413, -32600, "Request body too large.");
    }
    let parsedBody: unknown;
    let parsed = false;
    try {
        parsedBody = JSON.parse(raw);
        parsed = true;
    } catch {
        // Left to the SDK.
    }

    hooks.onRequestKind?.(parsed ? requestKind(parsedBody) : "invalid");

    if (Array.isArray(parsedBody) && parsedBody.length > MAX_BATCH_MESSAGES) {
        return jsonRpcError(
            400,
            -32600,
            `Too many messages in one request (limit ${MAX_BATCH_MESSAGES}). Send them separately.`,
        );
    }

    if (parsed) {
        const { connection, perRequest } = findClient(parsedBody);
        if (connection) hooks.onInitialize?.(connection);
        if (perRequest) hooks.onClientInfo?.(perRequest);
    }

    const forwarded = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: raw,
    });
    const legacy = await isLegacyRequest(forwarded, parsed ? parsedBody : undefined);
    const serve = legacy ? serveLegacy : serveModern;
    return withCors(await serve(forwarded, parsedBody, parsed, env, hooks));
}
