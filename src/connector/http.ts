/**
 * The connector's HTTP endpoint: MCP over Streamable HTTP, served statelessly.
 *
 * Every tool only reads data and returns at once, so nothing has to be
 * remembered between requests. Each POST therefore gets its own MCP server and
 * transport, answers with plain JSON, and is finished. There is no session and
 * no Durable Object: creating one per conversation cost about a second before
 * the first tool could run, and tied every later call to that one object.
 *
 * What follows from being stateless:
 *
 * - No `Mcp-Session-Id` is issued. One sent by a client that connected before
 *   this change is ignored, so those clients keep working.
 * - `GET` (a server-to-client event stream) and `DELETE` (ending a session)
 *   have nothing to act on and return 405, as the MCP specification allows.
 *
 * Like the rest of `connector/`, this file imports nothing Workers-only, so it
 * runs under `node --test`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
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
    /** Called when a client opens a connection (an `initialize` request). */
    onInitialize?: (client: McpClientInfo) => void;
}

// MCP clients such as Claude and ChatGPT connect from their own servers, and
// browser-based clients from any origin, so the endpoint is open to all.
const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
        "Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version",
    "Access-Control-Max-Age": "86400",
};

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

/** The `clientInfo` of an `initialize` message in a parsed request body, if there is one. */
function findInitialize(body: unknown): McpClientInfo | null {
    const messages = Array.isArray(body) ? body : [body];
    for (const message of messages) {
        if (!message || typeof message !== "object") continue;
        const { method, params } = message as { method?: unknown; params?: unknown };
        if (method !== "initialize") continue;
        const info = (params as { clientInfo?: unknown } | undefined)?.clientInfo;
        const { name, version } = (info ?? {}) as { name?: unknown; version?: unknown };
        return {
            name: typeof name === "string" ? name : undefined,
            version: typeof version === "string" ? version : undefined,
        };
    }
    return null;
}

/** Answer one request to the MCP endpoint. */
export async function handleMcpRequest(
    request: Request,
    env: Env,
    hooks: McpRequestHooks = {},
): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (request.method !== "POST") return methodNotAllowed();

    // Read the body once: to notice an `initialize`, and to hand the transport
    // the parsed message. Invalid JSON is passed through untouched so the
    // transport reports it the standard way.
    const raw = await request.text();
    let parsedBody: unknown;
    let parsed = false;
    try {
        parsedBody = JSON.parse(raw);
        parsed = true;
    } catch {
        // Left to the transport.
    }

    if (parsed) {
        const client = findInitialize(parsedBody);
        if (client) hooks.onInitialize?.(client);
    }

    // A stateless transport cannot be shared: a fresh server and transport per
    // request keeps one client's message ids from colliding with another's.
    const server = new McpServer(CONNECTOR_INFO, { instructions: CONNECTOR_INSTRUCTIONS });
    registerConnectorTools(server, env, hooks.onCall);
    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });

    try {
        await server.connect(transport);
        const forwarded = new Request(request.url, {
            method: "POST",
            headers: request.headers,
            body: raw,
        });
        const response = await transport.handleRequest(
            forwarded,
            parsed ? { parsedBody } : undefined,
        );
        return withCors(response);
    } finally {
        // The JSON response is complete by now; release the server's handlers.
        await server.close().catch(() => {});
    }
}
