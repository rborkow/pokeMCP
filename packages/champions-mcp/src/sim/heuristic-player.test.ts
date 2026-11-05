import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseTeamInput, SAMPLE_TEAM_PASTE } from "../team.js";
import { loadPool } from "../tools/simulate.js";
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

describe("locked/charge-move targeting", () => {
    it("does not crash on a locked second-turn Electro Shot (pool 16 seed 16001)", async () => {
        // Regression: on a charge move's release turn (and analogous locked
        // states — recharge, Outrage, Dig/Fly) the request exposes a single
        // targetless move entry; the heuristic used to append ` 1` anyway and
        // the sim threw "[Invalid choice] Can't move: You can't choose a
        // target for Electro Shot". Pool index 16 (Archaludon, Electro Shot)
        // at this exact seed reproduces it deterministically.
        const pool = loadPool();
        const archaludon = pool[16].sets.some((s) => s.moves?.includes("Electro Shot"));
        assert.ok(archaludon, "pool index 16 must carry Electro Shot for this regression");
        const p1 = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
        const r = await runSeries({
            p1,
            p2: pool[16].sets,
            games: 10,
            seed: 16001,
            makeP1: heuristicSamplingPlayer,
            makeP2: heuristicSamplingPlayer,
        });
        assert.equal(r.games, 10);
    });
    it("the fixed heuristic policy survives the same locked-move series", async () => {
        const pool = loadPool();
        const p1 = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
        const r = await runSeries({
            p1,
            p2: pool[16].sets,
            games: 20,
            seed: 1,
            makeP1: heuristicPlayer,
            makeP2: heuristicPlayer,
        });
        assert.equal(r.games, 20);
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
    it("beats the random policy in a 40-game mirror (measured 35/40; asserts >= 24)", async () => {
        const team = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
        const r = await runSeries({
            p1: team,
            p2: team,
            games: 40,
            seed: 11,
            makeP1: heuristicSamplingPlayer,
            makeP2: randomPlayer,
        });
        assert.ok(r.p1Wins >= 24, `sampling heuristic won ${r.p1Wins}/40`);
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
