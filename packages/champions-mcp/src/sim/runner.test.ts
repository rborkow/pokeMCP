import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseTeamInput, SAMPLE_TEAM_PASTE } from "../team.js";
import { type PlayerFactory, randomPlayer, runGame, runSeries } from "./runner.js";

describe("runSeries", () => {
    it("plays N seeded games and is deterministic for a given seed", async () => {
        const team = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
        const a = await runSeries({ p1: team, p2: team, games: 6, seed: 7 });
        const b = await runSeries({ p1: team, p2: team, games: 6, seed: 7 });
        assert.equal(a.games, 6);
        assert.equal(a.p1Wins + a.p2Wins + a.ties, 6);
        assert.deepEqual(
            a.results.map((r) => r.winner),
            b.results.map((r) => r.winner),
        );
        assert.ok(a.results.every((r) => r.turns > 0));
        assert.ok(
            a.results.every((r) => r.p1Lead.length === 2 && r.p2Lead.length === 2),
            JSON.stringify(a.results[0]),
        );
        assert.ok(a.leadStats.length > 0);
    });
    it("different seeds give different game logs", async () => {
        const team = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
        const a = await runSeries({ p1: team, p2: team, games: 3, seed: 1 });
        const b = await runSeries({ p1: team, p2: team, games: 3, seed: 2 });
        assert.notDeepEqual(
            a.results.map((r) => r.log.join("\n")),
            b.results.map((r) => r.log.join("\n")),
        );
    });
    it("rejects runGame when a player start() fails before the game ends", async () => {
        const team = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
        const exploding: PlayerFactory = () => ({
            start: () => Promise.reject(new Error("player exploded")),
        });
        await assert.rejects(runGame(team, team, 1, exploding, exploding), /player exploded/);
    });
    it("swallows a player start() rejection that lands after the game resolved", async () => {
        const team = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
        const unhandled: unknown[] = [];
        const onUnhandled = (reason: unknown) => unhandled.push(reason);
        process.prependListener("unhandledRejection", onUnhandled);
        const logged: unknown[][] = [];
        const realError = console.error;
        console.error = (...args: unknown[]) => logged.push(args);
        try {
            // The game is driven by a real random AI; the start() promise we
            // hand the runner is rejected externally only after it resolved.
            let rejectStart: ((error: unknown) => void) | undefined;
            const lateFailer: PlayerFactory = (stream, seed) => {
                const real = randomPlayer(stream, seed);
                return {
                    start: () => {
                        void real.start();
                        return new Promise<void>((_, reject) => {
                            rejectStart = reject;
                        });
                    },
                };
            };
            const result = await runGame(team, team, 9, lateFailer, lateFailer);
            assert.ok(result.winner);
            rejectStart?.(new Error("late boom"));
            await new Promise((r) => setTimeout(r, 20));
        } finally {
            console.error = realError;
            process.removeListener("unhandledRejection", onUnhandled);
        }
        assert.deepEqual(unhandled, []);
        assert.ok(
            logged.some((entry) => entry.includes("sim: late player error ignored:")),
            JSON.stringify(logged),
        );
    });
});
