import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gradePredictions, type Prediction } from "../../scripts/lib/grade-predictions.js";

const base = (overrides: Partial<Prediction>): Prediction => ({
    month: "2026-07",
    slug: "champions",
    pokemonId: "basculegion",
    pokemonName: "Basculegion",
    claim: "Basculegion keeps climbing",
    direction: "up",
    thresholdPts: 3,
    confidence: "likely",
    falsifier: "Usage fails to gain 3 points",
    evidence: "Basculegion: Apr 32.70%, May 43.88%",
    baselineUsagePct: 43.88,
    ...overrides,
});

describe("gradePredictions", () => {
    it("grades an up call correct when usage gains at least the threshold", () => {
        const [graded] = gradePredictions([base({})], new Map([["basculegion", 47.0]]));
        assert.equal(graded.grade, "correct");
        assert.ok(Math.abs(graded.deltaPts - 3.12) < 0.001);
    });

    it("grades an up call wrong when usage falls", () => {
        const [graded] = gradePredictions([base({})], new Map([["basculegion", 40.0]]));
        assert.equal(graded.grade, "wrong");
    });

    it("grades an up call unclear when usage gains less than the threshold", () => {
        const [graded] = gradePredictions([base({})], new Map([["basculegion", 45.0]]));
        assert.equal(graded.grade, "unclear");
    });

    it("grades a down call correct when usage drops past the threshold", () => {
        const [graded] = gradePredictions(
            [base({ direction: "down", baselineUsagePct: 28.7, thresholdPts: 5 })],
            new Map([["basculegion", 20.0]]),
        );
        assert.equal(graded.grade, "correct");
    });

    it("grades a down call wrong when usage rises", () => {
        const [graded] = gradePredictions(
            [base({ direction: "down", baselineUsagePct: 28.7, thresholdPts: 5 })],
            new Map([["basculegion", 30.0]]),
        );
        assert.equal(graded.grade, "wrong");
    });

    it("treats a Pokémon missing from the latest data as 0% usage", () => {
        const [graded] = gradePredictions(
            [base({ direction: "down", thresholdPts: 10 })],
            new Map(),
        );
        assert.equal(graded.actualUsagePct, 0);
        assert.equal(graded.grade, "correct"); // dropped out entirely = down call lands
    });

    it("grades exactly-at-threshold movement as correct", () => {
        const [graded] = gradePredictions(
            [base({ baselineUsagePct: 40, thresholdPts: 3 })],
            new Map([["basculegion", 43.0]]),
        );
        assert.equal(graded.grade, "correct");
    });

    it("grades zero movement on an up call as wrong, not unclear", () => {
        const [graded] = gradePredictions(
            [base({ baselineUsagePct: 40 })],
            new Map([["basculegion", 40.0]]),
        );
        assert.equal(graded.grade, "wrong");
    });
});
