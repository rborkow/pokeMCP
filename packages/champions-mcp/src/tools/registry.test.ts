import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { findTool, TOOLS } from "./registry.js";

describe("tool registry", () => {
    it("has unique names and a ping tool", async () => {
        const names = TOOLS.map((t) => t.name);
        assert.equal(new Set(names).size, names.length);
        const ping = findTool("ping");
        assert.ok(ping);
        const out = await ping.execute({});
        assert.match(out, /champions-mcp ok/);
    });
});
