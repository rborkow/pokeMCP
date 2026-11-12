/**
 * Tests for the connector's stateless HTTP endpoint (src/connector/http.ts).
 *
 * The first test in each era drives the endpoint with the MCP SDK's own
 * Streamable HTTP client, so it covers what a real client does on connect. The
 * rest pin the wire behaviour clients depend on. The endpoint serves both the
 * 2025-era protocol (an `initialize` handshake) and 2026-07-28 (stateless, with
 * per-request `_meta` and `Mcp-Method` / `Mcp-Name` headers).
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

import {
    handleMcpRequest,
    LIST_CACHE_TTL_MS,
    MAX_BATCH_MESSAGES,
    MAX_BODY_BYTES,
    type McpClientInfo,
} from "../connector/http.js";
import type { ConnectorCallInfo } from "../connector/register.js";
import { CONNECTOR_TOOLS } from "../connector/tools.js";

const URL_MCP = "https://api.pokemcp.com/mcp";
// The tools used here read only bundled data, so no KV or D1 is needed.
const env = {} as Env;

const JSON_HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
};

function post(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request(URL_MCP, {
        method: "POST",
        headers: { ...JSON_HEADERS, ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

const toolsList = (id: number | string) => ({ jsonrpc: "2.0", id, method: "tools/list" });
const lookup = (id: number, pokemon: string) => ({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: "lookup_pokemon", arguments: { pokemon } },
});

describe("stateless MCP endpoint", () => {
    it("serves a real MCP client: connect, list tools, call a tool", async () => {
        const calls: ConnectorCallInfo[] = [];
        const clients: McpClientInfo[] = [];
        const methods: string[] = [];

        const transport = new StreamableHTTPClientTransport(new URL(URL_MCP), {
            fetch: async (input, init) => {
                const request = new Request(input as string | URL, init as RequestInit);
                methods.push(request.method);
                return handleMcpRequest(request, env, {
                    onCall: (info) => calls.push(info),
                    onInitialize: (client) => clients.push(client),
                });
            },
        });
        const client = new Client({ name: "test-client", version: "9.9.9" });
        await client.connect(transport);

        assert.equal(client.getServerVersion()?.name, "vgc-teambuilder");
        assert.deepEqual(clients, [{ name: "test-client", version: "9.9.9" }]);
        assert.equal(transport.sessionId, undefined, "no session is issued");

        const { tools } = await client.listTools();
        assert.equal(tools.length, CONNECTOR_TOOLS.length);

        const result = await client.callTool({ name: "list_formats", arguments: {} });
        assert.equal(result.isError, undefined);
        assert.ok((result.structuredContent as { formats: unknown[] }).formats.length > 0);
        assert.deepEqual(
            calls.map((call) => [call.tool, call.success]),
            [["list_formats", true]],
        );

        await client.close();
        assert.ok(methods.includes("POST"));
    });

    it("answers a request that never initialized and carries an old session id", async () => {
        const response = await handleMcpRequest(
            post(toolsList(7), { "mcp-session-id": "a".repeat(64) }),
            env,
        );
        assert.equal(response.status, 200);
        assert.match(response.headers.get("Content-Type") ?? "", /^application\/json/);
        assert.equal(response.headers.get("mcp-session-id"), null);

        const body = (await response.json()) as { id: number; result: { tools: unknown[] } };
        assert.equal(body.id, 7);
        assert.equal(body.result.tools.length, CONNECTOR_TOOLS.length);
    });

    it("keeps concurrent requests apart", async () => {
        const names = ["Garchomp", "Kingambit", "Incineroar", "Rillaboom", "Sneasler", "Pelipper"];
        const responses = await Promise.all(
            names.map((name, index) => handleMcpRequest(post(lookup(index + 1, name)), env)),
        );
        const bodies = (await Promise.all(responses.map((r) => r.json()))) as {
            id: number;
            result: { structuredContent: { name: string } };
        }[];
        bodies.forEach((body, index) => {
            assert.equal(body.id, index + 1);
            assert.equal(body.result.structuredContent.name, names[index]);
        });
    });

    it("accepts a notification without a reply body", async () => {
        const response = await handleMcpRequest(
            post({ jsonrpc: "2.0", method: "notifications/initialized" }),
            env,
        );
        assert.equal(response.status, 202);
    });

    it("reports a tool failure as a tool error, not an HTTP error", async () => {
        const response = await handleMcpRequest(post(lookup(1, "Notapokemonatall")), env);
        assert.equal(response.status, 200);
        const body = (await response.json()) as { result: { isError?: boolean } };
        assert.equal(body.result.isError, true);
    });

    for (const method of ["GET", "DELETE"]) {
        it(`refuses ${method}, which has nothing to act on without sessions`, async () => {
            const response = await handleMcpRequest(new Request(URL_MCP, { method }), env);
            assert.equal(response.status, 405);
            assert.equal(response.headers.get("Allow"), "POST, OPTIONS");
            assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
        });
    }

    it("answers a browser preflight", async () => {
        const response = await handleMcpRequest(
            new Request(URL_MCP, {
                method: "OPTIONS",
                headers: { Origin: "https://example.com", "Access-Control-Request-Method": "POST" },
            }),
            env,
        );
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
        assert.match(response.headers.get("Access-Control-Allow-Headers") ?? "", /mcp-session-id/);
        assert.match(response.headers.get("Access-Control-Allow-Methods") ?? "", /POST/);
    });

    it("rejects a body that is not JSON", async () => {
        const response = await handleMcpRequest(post("{not json"), env);
        assert.equal(response.status, 400);
        const body = (await response.json()) as { error: { code: number } };
        assert.equal(body.error.code, -32700);
        assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
    });

    it("rejects a client that does not accept both response types", async () => {
        const response = await handleMcpRequest(
            new Request(URL_MCP, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(toolsList(1)),
            }),
            env,
        );
        assert.equal(response.status, 406);
    });

    it("refuses a batch larger than the limit without running any of it", async () => {
        const calls: ConnectorCallInfo[] = [];
        const batch = Array.from({ length: MAX_BATCH_MESSAGES + 1 }, (_, i) =>
            lookup(i + 1, "Garchomp"),
        );
        const response = await handleMcpRequest(post(batch), env, {
            onCall: (info) => calls.push(info),
        });
        assert.equal(response.status, 400);
        const body = (await response.json()) as { error: { code: number; message: string } };
        assert.equal(body.error.code, -32600);
        assert.match(body.error.message, /Too many messages/);
        assert.equal(calls.length, 0);
    });

    it("still answers a small batch", async () => {
        const response = await handleMcpRequest(post([toolsList(1), lookup(2, "Garchomp")]), env);
        assert.equal(response.status, 200);
        const body = (await response.json()) as { id: number }[];
        assert.deepEqual(body.map((message) => message.id).sort(), [1, 2]);
    });

    it("refuses an oversized body, whether or not its length is declared", async () => {
        const huge = JSON.stringify({ ...toolsList(1), padding: "x".repeat(MAX_BODY_BYTES) });

        const declared = await handleMcpRequest(
            post(huge, { "Content-Length": String(huge.length) }),
            env,
        );
        assert.equal(declared.status, 413);

        // A streamed body carries no Content-Length, so the cap is enforced while reading.
        const streamed = await handleMcpRequest(
            new Request(URL_MCP, {
                method: "POST",
                headers: JSON_HEADERS,
                body: new Blob([huge]).stream(),
                duplex: "half",
            } as RequestInit),
            env,
        );
        assert.equal(streamed.status, 413);
    });

    it("does not report an initialize for other requests", async () => {
        let initialized = 0;
        await handleMcpRequest(post(toolsList(1)), env, { onInitialize: () => initialized++ });
        assert.equal(initialized, 0);
    });
});

// --- 2026-07-28 (the current MCP revision) ---

const MODERN = "2026-07-28";

function modernPost(
    method: string,
    params: Record<string, unknown> = {},
    options: { id?: number; headers?: Record<string, string>; version?: string } = {},
): Request {
    const version = options.version ?? MODERN;
    const headers: Record<string, string> = {
        "MCP-Protocol-Version": version,
        "Mcp-Method": method,
        ...(method === "tools/call" ? { "Mcp-Name": String(params.name) } : {}),
        ...options.headers,
    };
    return post(
        {
            jsonrpc: "2.0",
            id: options.id ?? 1,
            method,
            params: {
                ...params,
                _meta: {
                    "io.modelcontextprotocol/protocolVersion": version,
                    "io.modelcontextprotocol/clientInfo": { name: "modern-client", version: "2.0" },
                    "io.modelcontextprotocol/clientCapabilities": {},
                },
            },
        },
        headers,
    );
}

describe("2026-07-28 MCP endpoint", () => {
    it("serves a real 2026-07-28 client: discover, list tools, call a tool", async () => {
        const calls: ConnectorCallInfo[] = [];
        const connections: McpClientInfo[] = [];
        const named: McpClientInfo[] = [];

        const transport = new StreamableHTTPClientTransport(new URL(URL_MCP), {
            fetch: async (input, init) =>
                handleMcpRequest(new Request(input as string | URL, init as RequestInit), env, {
                    onCall: (info) => calls.push(info),
                    onInitialize: (client) => connections.push(client),
                    onClientInfo: (client) => named.push(client),
                }),
        });
        const client = new Client(
            { name: "modern-test", version: "1.0.0" },
            { versionNegotiation: { mode: { pin: MODERN } } },
        );
        await client.connect(transport);
        assert.equal(client.getNegotiatedProtocolVersion(), MODERN);

        const { tools } = await client.listTools();
        assert.equal(tools.length, CONNECTOR_TOOLS.length);

        const result = await client.callTool({ name: "list_formats", arguments: {} });
        assert.equal(result.isError, undefined);
        assert.ok((result.structuredContent as { formats: unknown[] }).formats.length > 0);

        assert.deepEqual(
            calls.map((call) => [call.tool, call.success]),
            [["list_formats", true]],
        );
        // server/discover counts as the connection; every request names the client.
        assert.deepEqual(connections, [{ name: "modern-test", version: "1.0.0" }]);
        assert.equal(named.length, 3);
        await client.close();
    });

    it("negotiates 2026-07-28 with a client that probes before choosing", async () => {
        const transport = new StreamableHTTPClientTransport(new URL(URL_MCP), {
            fetch: async (input, init) =>
                handleMcpRequest(new Request(input as string | URL, init as RequestInit), env),
        });
        const client = new Client(
            { name: "auto-test", version: "1.0.0" },
            { versionNegotiation: { mode: "auto" } },
        );
        await client.connect(transport);
        assert.equal(client.getNegotiatedProtocolVersion(), MODERN);
        await client.close();
    });

    it("advertises its versions and identity from server/discover", async () => {
        const response = await handleMcpRequest(modernPost("server/discover"), env);
        assert.equal(response.status, 200);
        assert.match(response.headers.get("Content-Type") ?? "", /^application\/json/);
        assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
        const { result } = (await response.json()) as {
            result: {
                supportedVersions: string[];
                capabilities: { tools?: { listChanged?: boolean } };
                serverInfo?: { name: string };
                ttlMs: number;
                cacheScope: string;
            };
        };
        assert.ok(result.supportedVersions.includes(MODERN));
        assert.equal(result.capabilities.tools?.listChanged, false);
        assert.equal(result.ttlMs, LIST_CACHE_TTL_MS);
        assert.equal(result.cacheScope, "public");
    });

    it("marks tools/list cacheable and identifies the server on each result", async () => {
        const response = await handleMcpRequest(modernPost("tools/list"), env);
        assert.equal(response.status, 200);
        const { result } = (await response.json()) as {
            result: {
                tools: { name: string }[];
                resultType: string;
                ttlMs: number;
                cacheScope: string;
                _meta: Record<string, { name: string }>;
            };
        };
        assert.deepEqual(
            result.tools.map((tool) => tool.name),
            CONNECTOR_TOOLS.map((tool) => tool.name),
            "tools are listed in a fixed order",
        );
        assert.equal(result.resultType, "complete");
        assert.equal(result.ttlMs, LIST_CACHE_TTL_MS);
        assert.equal(result.cacheScope, "public");
        assert.equal(result._meta["io.modelcontextprotocol/serverInfo"].name, "vgc-teambuilder");
    });

    it("answers a tool call without any handshake or session", async () => {
        const response = await handleMcpRequest(
            modernPost("tools/call", {
                name: "lookup_pokemon",
                arguments: { pokemon: "Garchomp" },
            }),
            env,
        );
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("mcp-session-id"), null);
        const { result } = (await response.json()) as {
            result: { resultType: string; structuredContent: { name: string } };
        };
        assert.equal(result.resultType, "complete");
        assert.equal(result.structuredContent.name, "Garchomp");
    });

    it("rejects a request whose headers disagree with its body", async () => {
        const response = await handleMcpRequest(
            modernPost(
                "tools/call",
                { name: "lookup_pokemon", arguments: { pokemon: "Garchomp" } },
                { headers: { "Mcp-Name": "validate_team" } },
            ),
            env,
        );
        assert.equal(response.status, 400);
        const body = (await response.json()) as { error: { code: number } };
        assert.equal(body.error.code, -32020);
    });

    it("rejects a request that omits a required header", async () => {
        const request = modernPost("tools/list");
        request.headers.delete("Mcp-Method");
        const response = await handleMcpRequest(request, env);
        assert.equal(response.status, 400);
        const body = (await response.json()) as { error: { code: number } };
        assert.equal(body.error.code, -32020);
    });

    it("names its supported versions when asked for one it does not serve", async () => {
        const response = await handleMcpRequest(
            modernPost("tools/list", {}, { version: "2099-01-01" }),
            env,
        );
        const body = (await response.json()) as {
            error: { code: number; data?: { supported?: string[] } };
        };
        assert.equal(body.error.code, -32022);
        assert.ok(body.error.data?.supported?.includes(MODERN));
    });

    it("still serves a 2025-era client statelessly with plain JSON", async () => {
        const response = await handleMcpRequest(
            post({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                    protocolVersion: "2025-11-25",
                    capabilities: {},
                    clientInfo: { name: "legacy-client", version: "1.0" },
                },
            }),
            env,
        );
        assert.equal(response.status, 200);
        assert.match(response.headers.get("Content-Type") ?? "", /^application\/json/);
        assert.equal(response.headers.get("mcp-session-id"), null);
        const { result } = (await response.json()) as {
            result: {
                protocolVersion: string;
                capabilities: { tools?: { listChanged?: boolean } };
            };
        };
        assert.equal(result.protocolVersion, "2025-11-25");
        assert.equal(result.capabilities.tools?.listChanged, false);
    });
});
