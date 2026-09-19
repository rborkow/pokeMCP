import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseTeamInput, SAMPLE_TEAM_PASTE } from "../team.js";
import { runSeries } from "./runner.js";

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
});
