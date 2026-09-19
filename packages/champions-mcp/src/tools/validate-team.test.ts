import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { SAMPLE_TEAM_PASTE } from "../team.js";
import { validateTeam } from "./validate-team.js";

describe("validate_team", () => {
    it("flags the one illegal move in the sample team and nothing else", async () => {
        const out = await validateTeam({ paste: SAMPLE_TEAM_PASTE });
        assert.match(out, /Incineroar can't learn Knock Off/);
        assert.match(out, /1 problem/);
    });
    it("enforces the 66 Stat Point cap and restricted bans", async () => {
        const out = await validateTeam({
            sets: [
                {
                    species: "Garchomp",
                    item: "Garchompite Z",
                    ability: "Rough Skin",
                    moves: ["Earthquake"],
                    evs: { hp: 32, atk: 32, spe: 32 },
                },
                { species: "Mewtwo", moves: ["Psychic"] },
            ],
        });
        assert.match(out, /96 total Stat Points/);
        assert.match(out, /Mewtwo is tagged Restricted Legendary/);
        assert.match(out, /at least 6/);
    });
});
