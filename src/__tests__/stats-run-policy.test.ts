import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldFailRun, shouldWriteDiscoveryFallback } from "../../scripts/lib/stats-run-policy.js";

describe("shouldFailRun", () => {
    it("fails when zero formats succeeded (full Smogon outage)", () => {
        assert.equal(shouldFailRun(0, 24), true);
    });

    it("fails when zero formats succeeded even with zero recorded failures", () => {
        // e.g. upload-stats over an empty/all-skipped cache dir: nothing
        // uploaded must never look like success.
        assert.equal(shouldFailRun(0, 0), true);
    });

    it("does not fail for a single lagging format among many successes", () => {
        assert.equal(shouldFailRun(23, 1), false);
    });

    it("does not fail when all formats succeed", () => {
        assert.equal(shouldFailRun(24, 0), false);
    });

    it("does not fail at exactly half failed", () => {
        // "more than half" is the threshold — a 50/50 split still passes
        // (loudly logged by the callers).
        assert.equal(shouldFailRun(12, 12), false);
    });

    it("fails when a majority of formats failed", () => {
        assert.equal(shouldFailRun(11, 13), true);
    });

    it("fails when the single only format failed", () => {
        assert.equal(shouldFailRun(0, 1), true);
    });

    it("does not fail when the single only format succeeded", () => {
        assert.equal(shouldFailRun(1, 0), false);
    });
});

describe("shouldWriteDiscoveryFallback", () => {
    it("writes the bootstrap fallback on a fresh clone (no existing file)", () => {
        assert.equal(shouldWriteDiscoveryFallback(false), true);
    });

    it("keeps an existing discovery file untouched (never clobbers good data)", () => {
        assert.equal(shouldWriteDiscoveryFallback(true), false);
    });
});
