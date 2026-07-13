import { describe, expect, it } from "vitest";
import { retiredIntegrationResponse } from "@/lib/retirement";

describe("retired integration response", () => {
    it("returns a cacheable 410 response with a concise migration message", async () => {
        const response = retiredIntegrationResponse();

        expect(response.status).toBe(410);
        expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
        await expect(response.json()).resolves.toEqual({
            error: "gone",
            message: "The public PokeMCP integration has been retired. Use PokeMCP Prep workflows instead.",
        });
    });
});
