/**
 * Tests for usage recording around the MCP endpoint (src/mcp-usage.ts): what
 * is written for a connection, a tool call and a failed request, and that
 * nothing a user typed is ever in it.
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { classifyClient, cleanClientLabel, userAgentProduct } from "../connector/client.js";
import { recordRateLimited, serveMcp } from "../mcp-usage.js";

interface DataPoint {
    indexes: string[];
    blobs: string[];
    doubles: number[];
}

function recorder() {
    const points: DataPoint[] = [];
    const env = {
        ANALYTICS: { writeDataPoint: (point: DataPoint) => points.push(point) },
    } as unknown as Env;
    const of = (event: string) => points.filter((point) => point.indexes[0] === event);
    return { env, points, of };
}

const URL_MCP = "https://api.pokemcp.com/mcp";

function post(body: unknown, userAgent = "test-agent/1.0"): Request {
    return new Request(URL_MCP, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            "User-Agent": userAgent,
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

const initialize = (name: string, version = "1.2.3") => ({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name, version },
    },
});

describe("client classification", () => {
    it("recognises the two assistants from the client name or the User-Agent", () => {
        assert.equal(classifyClient("claude-ai", null), "claude");
        assert.equal(classifyClient("Anthropic/Toolbox", null), "claude");
        assert.equal(classifyClient("openai-mcp", null), "chatgpt");
        assert.equal(classifyClient(null, "ChatGPT-User/1.0"), "chatgpt");
        assert.equal(classifyClient("some-client", "Claude-User"), "claude");
        assert.equal(classifyClient("mcp-inspector", "node"), "other");
        assert.equal(classifyClient(undefined, undefined), "other");
    });

    it("prefers the client name over the User-Agent", () => {
        assert.equal(classifyClient("openai-mcp", "claude-proxy"), "chatgpt");
    });

    it("keeps only the product from a User-Agent", () => {
        assert.equal(userAgentProduct("python-httpx/0.27.0"), "python-httpx");
        assert.equal(userAgentProduct("Mozilla/5.0 (Macintosh; Intel Mac OS X)"), "Mozilla");
        assert.equal(userAgentProduct(null), "");
    });

    it("strips anything unexpected from a reported client name", () => {
        assert.equal(cleanClientLabel("claude-ai"), "claude-ai");
        assert.equal(cleanClientLabel("<script>alert(1)</script>"), "scriptalert1/script");
        assert.equal(cleanClientLabel("x".repeat(200)).length, 60);
    });
});

describe("usage recording", () => {
    it("records a connection with the assistant that opened it", async () => {
        const { env, of } = recorder();
        const response = await serveMcp(post(initialize("claude-ai"), "Claude-User/1.0"), env);
        assert.equal(response.status, 200);

        const [connection] = of("session");
        assert.equal(connection.blobs[0], "connect");
        assert.match(connection.blobs[1], /^[0-9a-f-]{36}$/, "a random id, not a client value");
        assert.deepEqual(connection.blobs.slice(4), [
            "claude-ai",
            "1.2.3",
            "claude",
            "Claude-User",
        ]);

        const [request] = of("mcp_request");
        assert.deepEqual(request.blobs, ["initialize", "200", "claude"]);
        assert.ok(request.doubles[0] >= 0);
    });

    it("records a tool call with its outcome and the assistant, but not its arguments", async () => {
        const { env, points, of } = recorder();
        await serveMcp(
            post(
                {
                    jsonrpc: "2.0",
                    id: 2,
                    method: "tools/call",
                    params: { name: "lookup_pokemon", arguments: { pokemon: "Garchomp" } },
                },
                "openai-mcp/1.0.0",
            ),
            env,
        );

        const [call] = of("tool_call");
        assert.deepEqual(call.blobs, ["lookup_pokemon", "", "1", "", "mcp", "chatgpt"]);
        assert.deepEqual(of("mcp_request")[0].blobs, ["tools/call", "200", "chatgpt"]);
        assert.doesNotMatch(JSON.stringify(points), /Garchomp/i);
    });

    it("records a failed tool call as a failure", async () => {
        const { env, of } = recorder();
        await serveMcp(
            post({
                jsonrpc: "2.0",
                id: 3,
                method: "tools/call",
                params: { name: "lookup_pokemon", arguments: { pokemon: "Notapokemonatall" } },
            }),
            env,
        );
        assert.equal(of("tool_call")[0].blobs[2], "0");
    });

    it("records requests that never reach a tool", async () => {
        const { env, of } = recorder();
        await serveMcp(post("{not json"), env);
        await serveMcp(new Request(URL_MCP, { method: "GET" }), env);
        await serveMcp(post({ jsonrpc: "2.0", id: 9, method: "resources/made-up-name" }), env);

        assert.deepEqual(
            of("mcp_request").map((point) => point.blobs.slice(0, 2)),
            [
                ["invalid", "400"],
                ["http_get", "405"],
                ["other", "200"],
            ],
        );
    });

    it("does not record browser preflights", async () => {
        const { env, points } = recorder();
        await serveMcp(new Request(URL_MCP, { method: "OPTIONS" }), env);
        assert.equal(points.length, 0);
    });

    it("records a rate-limited request", () => {
        const { env, of } = recorder();
        recordRateLimited(post({}, "ChatGPT-User"), env);
        assert.deepEqual(of("mcp_request")[0].blobs, ["rate_limited", "429", "chatgpt"]);
    });

    it("keeps working when the analytics binding is missing", async () => {
        const response = await serveMcp(post(initialize("claude-ai")), {} as Env);
        assert.equal(response.status, 200);
    });
});
