import { describe, expect, it } from "vitest";
import { retiredIntegrationResponse } from "@/lib/retirement";

describe("retired integration response", () => {
    it("returns a cacheable 410 response that points at the live MCP endpoint", async () => {
        const response = retiredIntegrationResponse();

        expect(response.status).toBe(410);
        expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
        await expect(response.json()).resolves.toEqual({
            error: "gone",
            message:
                "This address is no longer an MCP endpoint. Connect to the VGC Teambuilder connector at https://api.pokemcp.com/mcp.",
        });
    });
});
