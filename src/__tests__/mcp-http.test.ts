/**
 * Tests for the connector's stateless HTTP endpoint (src/connector/http.ts).
 *
 * The first test drives it with the MCP SDK's own Streamable HTTP client, so
 * it covers what a real client does on connect, including the event stream it
 * tries to open. The rest pin the wire behaviour clients depend on.
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { handleMcpRequest, type McpClientInfo } from "../connector/http.js";
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

    it("does not report an initialize for other requests", async () => {
        let initialized = 0;
        await handleMcpRequest(post(toolsList(1)), env, { onInitialize: () => initialized++ });
        assert.equal(initialized, 0);
    });
});
