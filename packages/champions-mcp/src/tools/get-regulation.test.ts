import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CURRENT_REGULATION, legalMegas, legalSpecies, regulationStatus } from "../regulation.js";
import { getRegulation } from "./get-regulation.js";

describe("get_regulation", () => {
    it("derives the roster from the champions mod", () => {
        const species = legalSpecies();
        assert.ok(species.length > 300 && species.length < 500, `got ${species.length}`);
        assert.ok(species.includes("Rillaboom"));
        assert.ok(!species.includes("Mewtwo"));
        const megas = legalMegas();
        assert.ok(
            megas.some((m) => m.name === "Golisopod-Mega" && m.requiredItem === "Golisopite"),
        );
    });
    it("reports active/expired against a date", () => {
        assert.equal(regulationStatus(new Date("2026-10-01")).state, "active");
        assert.equal(regulationStatus(new Date("2026-12-15")).state, "expired");
    });
    it("renders a digest", async () => {
        const out = await getRegulation({});
        assert.match(out, new RegExp(CURRENT_REGULATION.displayName));
        assert.match(out, /Megas \(\d+\)/);
    });
});
