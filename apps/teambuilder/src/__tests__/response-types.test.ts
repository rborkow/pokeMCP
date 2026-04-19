import { describe, expect, it } from "vitest";
import { parseResponseCard, ResponseCardSchema } from "@/lib/ai/response-types";

describe("response-types", () => {
    it("parses a valid data card", () => {
        const parsed = parseResponseCard({
            kind: "data",
            title: "Iron Valiant speed",
            rows: [
                { label: "Base", value: "116", tone: "neutral" },
                { label: "+Scarf", value: "415 max", tone: "good" },
            ],
        });
        expect(parsed).not.toBeNull();
        expect(parsed?.kind).toBe("data");
    });

    it("parses a valid team_diff card", () => {
        const parsed = parseResponseCard({
            kind: "team_diff",
            summary: "Swapped Rillaboom for Scizor to cover Garchomp.",
            changes: [{ slot: 3, from: "Rillaboom", to: "Scizor" }],
        });
        expect(parsed?.kind).toBe("team_diff");
    });

    it("parses a valid matchup card", () => {
        const parsed = parseResponseCard({
            kind: "matchup",
            opponent: "Scarf Garchomp",
            winRateEstimate: "31%",
        });
        expect(parsed?.kind).toBe("matchup");
    });

    it("parses a valid analysis_highlight card", () => {
        const parsed = parseResponseCard({
            kind: "analysis_highlight",
            focus: "Speed control",
            detail: "Iron Valiant is your only Tailwind answer.",
        });
        expect(parsed?.kind).toBe("analysis_highlight");
    });

    it("rejects unknown kinds", () => {
        const parsed = parseResponseCard({ kind: "mystery", detail: "?" });
        expect(parsed).toBeNull();
    });

    it("rejects a data card with zero rows", () => {
        const result = ResponseCardSchema.safeParse({
            kind: "data",
            title: "empty",
            rows: [],
        });
        expect(result.success).toBe(false);
    });

    it("rejects a team_diff card with an out-of-range slot", () => {
        const result = ResponseCardSchema.safeParse({
            kind: "team_diff",
            summary: "no",
            changes: [{ slot: 6, to: "Scizor" }],
        });
        expect(result.success).toBe(false);
    });
});
