import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mcpRateLimitResponse } from "../mcp-rate-limit.js";
import { getRetirementResponse } from "../retirement.js";

describe("public integration retirement", () => {
    for (const pathname of ["/sse", "/sse/message", "/api/tools"]) {
        it(`returns 410 for ${pathname}`, () => {
            assert.equal(getRetirementResponse(pathname, "GET")?.status, 410);
        });
    }

    it("leaves the public MCP endpoint live and points retired clients at it", async () => {
        assert.equal(getRetirementResponse("/mcp", "POST"), null);
        const body = (await getRetirementResponse("/sse", "GET")?.json()) as { message: string };
        assert.match(body.message, /api\.pokemcp\.com\/mcp/);
    });

    it("retires new stored team records but preserves legacy reads", () => {
        assert.equal(getRetirementResponse("/api/team/share", "POST")?.status, 410);
        assert.equal(getRetirementResponse("/api/team/abc123", "GET"), null);
    });
});

describe("public MCP rate limit", () => {
    const request = (method = "POST", ip = "203.0.113.7") =>
        new Request("https://api.pokemcp.com/mcp", {
            method,
            headers: { "CF-Connecting-IP": ip },
        });

    it("lets requests through under the limit, keyed by client IP", async () => {
        const keys: string[] = [];
        const limiter = {
            async limit({ key }: { key: string }) {
                keys.push(key);
                return { success: true };
            },
        };
        assert.equal(await mcpRateLimitResponse(request(), limiter), null);
        assert.deepEqual(keys, ["203.0.113.7"]);
    });

    it("answers 429 with Retry-After once the limit is hit", async () => {
        const limiter = { limit: async () => ({ success: false }) };
        const response = await mcpRateLimitResponse(request(), limiter);
        assert.equal(response?.status, 429);
        assert.equal(response?.headers.get("Retry-After"), "60");
        const body = (await response?.json()) as { error: { message: string } };
        assert.match(body.error.message, /Too many requests/);
    });

    it("fails open without a binding, on limiter errors, and for preflights", async () => {
        const broken = {
            limit: async () => {
                throw new Error("limiter unavailable");
            },
        };
        const blocking = { limit: async () => ({ success: false }) };
        assert.equal(await mcpRateLimitResponse(request(), undefined), null);
        assert.equal(await mcpRateLimitResponse(request(), broken), null);
        assert.equal(await mcpRateLimitResponse(request("OPTIONS"), blocking), null);
    });
});
