/**
 * Tests for the IngestionCoordinator's pure queue/retry logic.
 *
 * The Durable Object itself (src/ingestion/coordinator.ts) is a thin shell
 * around these functions — storage, alarms, and the actual ingestion are not
 * exercised here.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { RunState, SliceResult } from "../ingestion/coordinator-state.js";
import {
    createRunState,
    MAX_ATTEMPTS,
    planNextStep,
    summarizeRun,
} from "../ingestion/coordinator-state.js";

const ok = (
    pokemonProcessed: number,
    chunksIndexed: number,
    remaining?: string[],
): SliceResult => ({
    ok: true,
    pokemonProcessed,
    chunksIndexed,
    remainingPokemon: remaining,
});

const fail = (error: string): SliceResult => ({
    ok: false,
    pokemonProcessed: 0,
    chunksIndexed: 0,
    error,
});

describe("createRunState", () => {
    it("queues every format in order with zeroed counters", () => {
        const state = createRunState(["gen9ou", "gen9uu"], "2026-07-05T03:00:00.000Z");
        assert.equal(state.startedAt, "2026-07-05T03:00:00.000Z");
        assert.deepEqual(
            state.queue.map((item) => item.format),
            ["gen9ou", "gen9uu"],
        );
        for (const item of state.queue) {
            assert.equal(item.attempts, 0);
            assert.equal(item.pokemonProcessed, 0);
            assert.equal(item.chunksIndexed, 0);
            assert.equal(item.pendingPokemon, undefined);
        }
        assert.deepEqual(state.results, []);
    });
});

describe("planNextStep", () => {
    it("drains the queue on the happy path and records each result", () => {
        let state = createRunState(["gen9ou", "gen9uu", "gen9ru"], "t0");

        let step = planNextStep(state, ok(50, 300));
        assert.equal(step.done, false);
        state = step.state;

        step = planNextStep(state, ok(48, 275));
        assert.equal(step.done, false);
        state = step.state;

        step = planNextStep(state, ok(45, 250));
        assert.equal(step.done, true);
        state = step.state;

        assert.equal(state.queue.length, 0);
        assert.deepEqual(
            state.results.map((r) => [r.format, r.ok, r.pokemonProcessed, r.chunksIndexed]),
            [
                ["gen9ou", true, 50, 300],
                ["gen9uu", true, 48, 275],
                ["gen9ru", true, 45, 250],
            ],
        );
        assert.ok(state.results.every((r) => r.attempts === 1));
    });

    it("requeues a capped slice at the head and accumulates counts", () => {
        const state = createRunState(["gen9ou", "gen9uu"], "t0");

        // First slice of gen9ou processed 25 of 50 Pokemon.
        let step = planNextStep(state, ok(25, 140, ["pikachu", "eevee"]));
        assert.equal(step.done, false);
        assert.equal(step.state.queue[0].format, "gen9ou");
        assert.deepEqual(step.state.queue[0].pendingPokemon, ["pikachu", "eevee"]);
        assert.equal(step.state.queue[0].pokemonProcessed, 25);
        assert.equal(step.state.queue[0].chunksIndexed, 140);
        assert.equal(step.state.queue[1].format, "gen9uu");
        assert.deepEqual(step.state.results, []);

        // Second slice finishes the format; counts merge into one result.
        step = planNextStep(step.state, ok(2, 12));
        assert.equal(step.done, false);
        assert.equal(step.state.queue.length, 1);
        assert.equal(step.state.results.length, 1);
        assert.deepEqual(step.state.results[0], {
            format: "gen9ou",
            ok: true,
            pokemonProcessed: 27,
            chunksIndexed: 152,
            attempts: 1,
        });
    });

    it("treats an empty remainingPokemon array as format completion", () => {
        const state = createRunState(["gen9ou"], "t0");
        const step = planNextStep(state, ok(10, 60, []));
        assert.equal(step.done, true);
        assert.equal(step.state.results[0].ok, true);
    });

    it("requeues a failed format at the tail with progress reset", () => {
        const state = createRunState(["gen9ou", "gen9uu"], "t0");

        const step = planNextStep(state, fail("smogon 503"));
        assert.equal(step.done, false);
        // gen9uu moves up; gen9ou retries after it.
        assert.deepEqual(
            step.state.queue.map((item) => item.format),
            ["gen9uu", "gen9ou"],
        );
        const retried = step.state.queue[1];
        assert.equal(retried.attempts, 1);
        assert.equal(retried.pokemonProcessed, 0);
        assert.equal(retried.chunksIndexed, 0);
        assert.equal(retried.pendingPokemon, undefined);
        assert.deepEqual(step.state.results, []);
    });

    it("records the error after MAX_ATTEMPTS failures without stalling the chain", () => {
        assert.equal(MAX_ATTEMPTS, 2);
        let state = createRunState(["gen9ou", "gen9uu"], "t0");

        // gen9ou fails, requeued behind gen9uu.
        state = planNextStep(state, fail("smogon 503")).state;
        // gen9uu succeeds.
        state = planNextStep(state, ok(48, 275)).state;
        // gen9ou fails again — out of attempts, recorded as failed.
        const step = planNextStep(state, fail("smogon 503 again"));

        assert.equal(step.done, true);
        assert.equal(step.state.queue.length, 0);
        const failure = step.state.results.find((r) => r.format === "gen9ou");
        assert.ok(failure);
        assert.equal(failure.ok, false);
        assert.equal(failure.attempts, 2);
        assert.equal(failure.error, "smogon 503 again");
        assert.equal(step.state.results.find((r) => r.format === "gen9uu")?.ok, true);
    });

    it("is a no-op finish when called with an empty queue", () => {
        const state: RunState = { startedAt: "t0", queue: [], results: [] };
        const step = planNextStep(state, ok(1, 1));
        assert.equal(step.done, true);
        assert.deepEqual(step.state, state);
    });
});

describe("summarizeRun", () => {
    it("totals successes, failures, and counts", () => {
        let state = createRunState(["gen9ou", "gen9uu", "gen9ru"], "t0");
        state = planNextStep(state, ok(50, 300)).state;
        state = planNextStep(state, fail("boom")).state; // gen9uu → retry
        state = planNextStep(state, ok(45, 250)).state; // gen9ru
        state = planNextStep(state, fail("boom again")).state; // gen9uu → give up

        const summary = summarizeRun(state);
        assert.equal(summary.startedAt, "t0");
        assert.equal(summary.formats, 3);
        assert.equal(summary.succeeded, 2);
        assert.equal(summary.failed, 1);
        assert.equal(summary.pokemonProcessed, 95);
        assert.equal(summary.chunksIndexed, 550);
        assert.deepEqual(summary.failures, [{ format: "gen9uu", error: "boom again" }]);
    });
});
