/**
 * Tests for the Phase 2 usage-stats format resolver.
 *
 * Covers three cases:
 *   1. Plain Showdown format ids pass through unchanged.
 *   2. A Champions regulation with showdownFormatId remaps to it.
 *   3. A Champions regulation with no showdownFormatId reports unmapped.
 *
 * We exercise the resolver against the real Reg M-A and Reg M-B configs
 * (both now mapped to their published Smogon stats formats). The M-A test
 * that temporarily clears the field is kept as a regression guard for the
 * unmapped path itself.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { CHAMPIONS_REGMA } from "../regulations/champions-regma.js";
import { CHAMPIONS_REGMB } from "../regulations/champions-regmb.js";
import { listRegulationStatsFormats } from "../regulations/registry.js";
import { resolveStatsFormat } from "../regulations/stats-mapping.js";
import type { RegulationSet } from "../regulations/types.js";
import { getPopularSets } from "../stats.js";

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

    it("remaps Reg M-B to its published Champions stats format", () => {
        // Smogon publishes Reg M-B's doubles ladder as gen9championsvgc2026regmb.
        assert.equal(CHAMPIONS_REGMB.showdownFormatId, "gen9championsvgc2026regmb");
        const r = resolveStatsFormat("champions-regmb");
        assert.equal(r.resolvedId, "gen9championsvgc2026regmb");
        assert.equal(r.originalId, "champions-regmb");
        assert.equal(r.wasRemapped, true);
        assert.equal(r.championsUnmapped, false);
    });
});

describe("RegulationSet.showdownFormatId contract", () => {
    it("carries the published stats format for the mapped regulation", () => {
        const reg: RegulationSet = CHAMPIONS_REGMA;
        assert.equal(reg.showdownFormatId, "gen9championsvgc2026regma");
    });

    it("carries the published stats format for Reg M-B", () => {
        const reg: RegulationSet = CHAMPIONS_REGMB;
        assert.equal(reg.showdownFormatId, "gen9championsvgc2026regmb");
    });

    it("includes mapped regulations in the stats fetch pipeline", () => {
        const formats = listRegulationStatsFormats();
        assert.ok(formats.includes("gen9championsvgc2026regma"));
        assert.ok(formats.includes("gen9championsvgc2026regmb"));
    });

    it("excludes unmapped regulations from the stats fetch pipeline", () => {
        // Simulate the pre-publication state by temporarily clearing the field.
        const original = CHAMPIONS_REGMB.showdownFormatId;
        CHAMPIONS_REGMB.showdownFormatId = undefined;
        try {
            const formats = listRegulationStatsFormats();
            assert.ok(formats.includes("gen9championsvgc2026regma"));
            assert.ok(!formats.some((f) => f.includes("regmb")));
        } finally {
            CHAMPIONS_REGMB.showdownFormatId = original;
        }
    });
});

describe("stats tools — unmapped Champions regulation", () => {
    it("returns the Champions-aware unavailable message without hitting KV", async () => {
        // Env whose KV throws on any access: proves the unmapped path
        // short-circuits before storage is touched.
        const env = {
            POKEMON_STATS: {
                get: async () => {
                    throw new Error("KV must not be queried for an unmapped regulation");
                },
            },
        } as unknown as Env;
        const message = await getPopularSets(
            { pokemon: "Garchomp", format: "champions-regmb" },
            env,
        );
        assert.match(message, /champions-regmb/);
        assert.match(message, /not yet published/);
    });
});
