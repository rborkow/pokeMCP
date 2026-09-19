import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { calcDamage } from "./calc-damage.js";

describe("calc_damage", () => {
    it("uses champions-mod species data for Megas the calc package lacks", async () => {
        const out = await calcDamage({
            attacker: { species: "Golisopod-Mega", nature: "Adamant", statPoints: { atk: 32 } },
            defender: { species: "Rillaboom", nature: "Adamant", statPoints: { hp: 32 } },
            move: "First Impression",
        });
        // Verified 2026-09-19 against @smogon/calc 0.12.0 gen 0 with champions-mod overrides.
        assert.match(out, /Golisopod-Mega First Impression vs\. 32 HP \/ 0 Def Rillaboom: 296-350/);
        assert.match(out, /guaranteed OHKO/);
    });
    it("rejects unknown species and moves", async () => {
        await assert.rejects(
            () =>
                calcDamage({
                    attacker: { species: "Nope" },
                    defender: { species: "Rillaboom" },
                    move: "Tackle",
                }),
            /Unknown Pokémon/,
        );
        await assert.rejects(
            () =>
                calcDamage({
                    attacker: { species: "Rillaboom" },
                    defender: { species: "Rillaboom" },
                    move: "Nope",
                }),
            /Unknown move/,
        );
    });
});
