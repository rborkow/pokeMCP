import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseTeamInput, SAMPLE_TEAM_PASTE } from "../team.js";
import { heuristicPlayer, heuristicSamplingPlayer } from "./heuristic-player.js";
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

describe("heuristicSamplingPlayer", () => {
    it("samples >= 5 distinct lead pairs over 40 games and leads are 2 team species", async () => {
        const team = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
        const species = new Set(team.map((s) => s.species));
        const r = await runSeries({
            p1: team,
            p2: team,
            games: 40,
            seed: 5,
            makeP1: heuristicSamplingPlayer,
            makeP2: heuristicSamplingPlayer,
        });
        assert.ok(r.leadStats.length >= 5, `only ${r.leadStats.length} distinct lead pairs`);
        for (const stat of r.leadStats) {
            const parts = stat.lead.split(" + ");
            assert.equal(parts.length, 2, `lead "${stat.lead}" is not a pair`);
            assert.notEqual(parts[0], parts[1], `lead "${stat.lead}" repeats a species`);
            for (const p of parts) assert.ok(species.has(p), `lead species ${p} not on team`);
        }
    });
    it("lead sequence is deterministic for a seed", async () => {
        const team = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
        const leads = async () => {
            const r = await runSeries({
                p1: team,
                p2: team,
                games: 8,
                seed: 5,
                makeP1: heuristicSamplingPlayer,
                makeP2: heuristicSamplingPlayer,
            });
            return r.results.map((g) => g.p1Lead.join(" + "));
        };
        assert.deepEqual(await leads(), await leads());
    });
});
