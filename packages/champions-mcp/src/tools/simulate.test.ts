import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { SAMPLE_TEAM_PASTE } from "../team.js";
import { evaluateTeam, simulateMatchup } from "./simulate.js";

describe("simulate tools", () => {
    it("simulate_matchup reports win rate and best leads", async () => {
        const out = await simulateMatchup({
            paste: SAMPLE_TEAM_PASTE,
            opponentPaste: SAMPLE_TEAM_PASTE,
            games: 10,
            seed: 3,
        });
        assert.match(out, /Win rate: \d+\/10/);
        assert.match(out, /Leads/);
    });
    it("evaluate_team runs the pool and ranks opponents by loss rate", async () => {
        const out = await evaluateTeam({
            paste: SAMPLE_TEAM_PASTE,
            gamesPerOpponent: 4,
            seed: 3,
            maxOpponents: 3,
        });
        assert.match(out, /Overall: \d+\/\d+/);
        assert.match(out, /Hardest opponents/);
    });
});
