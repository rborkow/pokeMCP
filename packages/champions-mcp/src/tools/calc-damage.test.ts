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
    it("rejects unknown natures on either side instead of crashing in the calc", async () => {
        await assert.rejects(
            () =>
                calcDamage({
                    attacker: { species: "Kingambit", nature: "Nope" },
                    defender: { species: "Rillaboom" },
                    move: "Kowtow Cleave",
                }),
            /Unknown nature: Nope/,
        );
        await assert.rejects(
            () =>
                calcDamage({
                    attacker: { species: "Kingambit" },
                    defender: { species: "Rillaboom", nature: "Nope" },
                    move: "Kowtow Cleave",
                }),
            /Unknown nature: Nope/,
        );
    });
    it("rejects out-of-range, non-integer, and unknown boost keys", async () => {
        await assert.rejects(
            () =>
                calcDamage({
                    attacker: { species: "Kingambit", boosts: { atk: 99 } },
                    defender: { species: "Rillaboom" },
                    move: "Kowtow Cleave",
                }),
            /Invalid boost: atk=99 \(integer -6\.\.6 on atk\/def\/spa\/spd\/spe\/acc\/eva\)/,
        );
        await assert.rejects(
            () =>
                calcDamage({
                    attacker: { species: "Kingambit", boosts: { foo: 1 } },
                    defender: { species: "Rillaboom" },
                    move: "Kowtow Cleave",
                }),
            /Invalid boost: foo=1 \(integer -6\.\.6 on atk\/def\/spa\/spd\/spe\/acc\/eva\)/,
        );
    });
    it("rejects items the champions dex does not have", async () => {
        await assert.rejects(
            () =>
                calcDamage({
                    attacker: { species: "Kingambit", item: "Nopeium" },
                    defender: { species: "Rillaboom" },
                    move: "Kowtow Cleave",
                }),
            /Unknown item: Nopeium/,
        );
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
