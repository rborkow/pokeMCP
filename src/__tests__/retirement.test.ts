import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { getRetirementResponse } from "../retirement.js";

describe("public integration retirement", () => {
    for (const pathname of ["/mcp", "/sse", "/sse/message", "/api/tools"]) {
        it(`returns 410 for ${pathname}`, () => {
            assert.equal(getRetirementResponse(pathname, "GET")?.status, 410);
        });
    }

    it("retires new stored team records but preserves legacy reads", () => {
        assert.equal(getRetirementResponse("/api/team/share", "POST")?.status, 410);
        assert.equal(getRetirementResponse("/api/team/abc123", "GET"), null);
    });
});
