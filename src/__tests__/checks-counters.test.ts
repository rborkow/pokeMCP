/**
 * Regression tests for the checks_counters tool crash.
 *
 * The KV chaos data stores each "Checks and Counters" entry as an object
 * `{ n, p, d }` (encounters, win fraction, standard deviation), but the old
 * code destructured it as an array — so `score.toFixed()` threw a TypeError
 * on every call. parseChecksCounters must read the object shape and compute
 * Smogon's standard rating (p − 4·d) × 100, sorted descending.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { parseChecksCounters } from "../stats.js";

// Real values from src/cached-stats/gen9ou.json (Great Tusk's counters)
const GREAT_TUSK_COUNTERS = {
    Blaziken: { n: 64.60813825785324, p: 0.5145751840515245, d: 0.06217872222370473 },
    Corviknight: { n: 1981.1076864097606, p: 0.5406419430134434, d: 0.01119635074964433 },
    "Samurott-Hisui": { n: 1570.7863718763224, p: 0.20001547341995687, d: 0.010092854869224878 },
    "Iron Valiant": { n: 1403.9850266593278, p: 0.7772624969287252, d: 0.011104507252059546 },
    Dragonite: { n: 2412.0831079413974, p: 0.38311310150532335, d: 0.009898517192812971 },
};

describe("parseChecksCounters", () => {
    it("parses the object shape {n, p, d} without throwing", () => {
        const entries = parseChecksCounters(GREAT_TUSK_COUNTERS, 15);
        assert.equal(entries.length, 5);
        for (const entry of entries) {
            assert.equal(typeof entry.score, "number");
            assert.ok(Number.isFinite(entry.score));
            // toFixed is what the tool output calls — must not throw
            assert.doesNotThrow(() => entry.score.toFixed(1));
        }
    });

    it("computes the rating as (p − 4·d) × 100", () => {
        const entries = parseChecksCounters(GREAT_TUSK_COUNTERS, 15);
        const blaziken = entries.find((e) => e.name === "Blaziken");
        assert.ok(blaziken);
        const { p, d } = GREAT_TUSK_COUNTERS.Blaziken;
        assert.ok(Math.abs(blaziken.score - (p - 4 * d) * 100) < 1e-9);
        // (0.51458 − 4×0.06218) × 100 ≈ 26.6
        assert.equal(blaziken.score.toFixed(1), "26.6");
    });

    it("exposes the raw win rate as a percentage and rounds the sample size", () => {
        const entries = parseChecksCounters(GREAT_TUSK_COUNTERS, 15);
        const corviknight = entries.find((e) => e.name === "Corviknight");
        assert.ok(corviknight);
        assert.equal(corviknight.winRate.toFixed(1), "54.1");
        assert.equal(corviknight.sampleSize, 1981);
    });

    it("sorts by rating descending", () => {
        const entries = parseChecksCounters(GREAT_TUSK_COUNTERS, 15);
        const names = entries.map((e) => e.name);
        assert.deepEqual(names, [
            "Iron Valiant",
            "Corviknight",
            "Dragonite",
            "Blaziken",
            "Samurott-Hisui",
        ]);
        for (let i = 1; i < entries.length; i++) {
            assert.ok(entries[i - 1].score >= entries[i].score);
        }
    });

    it("respects the limit", () => {
        const entries = parseChecksCounters(GREAT_TUSK_COUNTERS, 2);
        assert.deepEqual(
            entries.map((e) => e.name),
            ["Iron Valiant", "Corviknight"],
        );
    });

    it("handles empty data", () => {
        assert.deepEqual(parseChecksCounters({}, 15), []);
    });
});
