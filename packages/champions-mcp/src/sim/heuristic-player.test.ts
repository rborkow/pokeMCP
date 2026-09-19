import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseTeamInput, SAMPLE_TEAM_PASTE } from "../team.js";
import { heuristicPlayer } from "./heuristic-player.js";
import { randomPlayer, runSeries } from "./runner.js";

describe("heuristicPlayer", () => {
    it("beats the random policy in a 40-game mirror (measured 31/40; asserts >= 28)", async () => {
        const team = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
        const r = await runSeries({
            p1: team,
            p2: team,
            games: 40,
            seed: 11,
            makeP1: heuristicPlayer,
            makeP2: randomPlayer,
        });
        assert.ok(r.p1Wins >= 28, `heuristic won ${r.p1Wins}/40`);
    });
    it("is deterministic for a seed", async () => {
        const team = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
        const a = await runSeries({
            p1: team,
            p2: team,
            games: 5,
            seed: 3,
            makeP1: heuristicPlayer,
            makeP2: heuristicPlayer,
        });
        const b = await runSeries({
            p1: team,
            p2: team,
            games: 5,
            seed: 3,
            makeP1: heuristicPlayer,
            makeP2: heuristicPlayer,
        });
        assert.deepEqual(
            a.results.map((g) => g.winner),
            b.results.map((g) => g.winner),
        );
    });
});
