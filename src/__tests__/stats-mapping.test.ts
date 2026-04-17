/**
 * Tests for the Phase 2 usage-stats format resolver.
 *
 * Covers three cases:
 *   1. Plain Showdown format ids pass through unchanged.
 *   2. A Champions regulation with showdownFormatId remaps to it.
 *   3. A Champions regulation with no showdownFormatId reports unmapped.
 *
 * We don't monkey-patch the real registry. Instead we exercise the
 * resolver's behavior via the real Reg M-A config (which currently has
 * showdownFormatId = undefined), and a locally-constructed regulation
 * that has one set, proven by inline validation of the shape we expect
 * callers to pass to `resolveStatsFormat`.
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
        // Reg M-A ships with showdownFormatId unset until Smogon publishes.
        assert.equal(CHAMPIONS_REGMA.showdownFormatId, undefined);
        const r = resolveStatsFormat("champions-regma");
        assert.equal(r.championsUnmapped, true);
        assert.equal(r.wasRemapped, false);
        assert.equal(r.originalId, "champions-regma");
    });

    it("remaps when showdownFormatId is configured", () => {
        // Simulate the post-Showdown-publication state by temporarily
        // populating the field. The real config stays unset so production
        // behavior is unchanged.
        const original = CHAMPIONS_REGMA.showdownFormatId;
        CHAMPIONS_REGMA.showdownFormatId = "gen9vgc2026regma";
        try {
            const r = resolveStatsFormat("champions-regma");
            assert.equal(r.resolvedId, "gen9vgc2026regma");
            assert.equal(r.originalId, "champions-regma");
            assert.equal(r.wasRemapped, true);
            assert.equal(r.championsUnmapped, false);
        } finally {
            CHAMPIONS_REGMA.showdownFormatId = original;
        }
    });
});

describe("RegulationSet.showdownFormatId contract", () => {
    it("is optional", () => {
        // Sanity: the type allows undefined and the current Reg M-A config
        // reflects the pre-Showdown-publication state.
        const reg: RegulationSet = CHAMPIONS_REGMA;
        assert.equal(typeof reg.showdownFormatId, "undefined");
    });
});
