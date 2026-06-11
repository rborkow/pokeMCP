/**
 * Tests for the Phase 2 usage-stats format resolver.
 *
 * Covers three cases:
 *   1. Plain Showdown format ids pass through unchanged.
 *   2. A Champions regulation with showdownFormatId remaps to it.
 *   3. A Champions regulation with no showdownFormatId reports unmapped.
 *
 * We exercise the resolver against the real Reg M-A config (now mapped to
 * its published Smogon stats format) and, by temporarily clearing the field,
 * the pre-publication "unmapped" path.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { CHAMPIONS_REGMA } from "../regulations/champions-regma.js";
import { resolveStatsFormat } from "../regulations/stats-mapping.js";
import type { RegulationSet } from "../regulations/types.js";

describe("resolveStatsFormat", () => {
    it("passes plain Showdown format ids through unchanged", () => {
        const r = resolveStatsFormat("gen9ou");
        assert.equal(r.resolvedId, "gen9ou");
        assert.equal(r.originalId, "gen9ou");
        assert.equal(r.wasRemapped, false);
        assert.equal(r.championsUnmapped, false);
    });

    it("passes existing VGC format ids through unchanged", () => {
        const r = resolveStatsFormat("gen9vgc2026regf");
        assert.equal(r.resolvedId, "gen9vgc2026regf");
        assert.equal(r.wasRemapped, false);
        assert.equal(r.championsUnmapped, false);
    });

    it("marks an unmapped Champions regulation as unmapped", () => {
        // Simulate the pre-publication state by temporarily clearing the field.
        const original = CHAMPIONS_REGMA.showdownFormatId;
        CHAMPIONS_REGMA.showdownFormatId = undefined;
        try {
            const r = resolveStatsFormat("champions-regma");
            assert.equal(r.championsUnmapped, true);
            assert.equal(r.wasRemapped, false);
            assert.equal(r.originalId, "champions-regma");
        } finally {
            CHAMPIONS_REGMA.showdownFormatId = original;
        }
    });

    it("remaps Reg M-A to its published Champions stats format", () => {
        // Smogon publishes Reg M-A's doubles ladder as gen9championsvgc2026regma.
        assert.equal(CHAMPIONS_REGMA.showdownFormatId, "gen9championsvgc2026regma");
        const r = resolveStatsFormat("champions-regma");
        assert.equal(r.resolvedId, "gen9championsvgc2026regma");
        assert.equal(r.originalId, "champions-regma");
        assert.equal(r.wasRemapped, true);
        assert.equal(r.championsUnmapped, false);
    });
});

describe("RegulationSet.showdownFormatId contract", () => {
    it("carries the published stats format for the mapped regulation", () => {
        const reg: RegulationSet = CHAMPIONS_REGMA;
        assert.equal(reg.showdownFormatId, "gen9championsvgc2026regma");
    });
});
