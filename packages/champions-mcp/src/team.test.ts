import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseTeamInput, SAMPLE_TEAM_PASTE, toPacked } from "./team.js";

describe("team input", () => {
    it("parses a Showdown paste into 6 sets with Stat Points as EVs", () => {
        const team = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
        assert.equal(team.length, 6);
        assert.equal(team[0].species, "Staraptor");
        assert.equal(team[0].item, "Staraptite");
        assert.deepEqual(team[0].evs, { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 });
        assert.equal(team[0].level, 50);
    });
    it("accepts structured sets and defaults level to 50", () => {
        const team = parseTeamInput({
            sets: [
                {
                    species: "Rillaboom",
                    item: "Miracle Seed",
                    ability: "Grassy Surge",
                    moves: ["Fake Out"],
                },
            ],
        });
        assert.equal(team[0].level, 50);
        assert.ok(toPacked(team).includes("Rillaboom"));
    });
    it("rejects empty input", () => {
        assert.throws(() => parseTeamInput({}), /paste or sets/);
    });
});
