import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { assertNature, assertStatPoints, championsStats } from "./stats.js";

describe("championsStats", () => {
    it("matches the Showdown champions mod formula (HP = base+SP+75, others base+SP+20, nature)", () => {
        // Verified against @smogon/calc gen 0: Rillaboom 32 HP / 32 Atk Adamant.
        const s = championsStats(
            { hp: 100, atk: 125, def: 90, spa: 60, spd: 70, spe: 85 },
            { hp: 32, atk: 32 },
            "Adamant",
        );
        assert.deepEqual(s, { hp: 207, atk: 194, def: 110, spa: 72, spd: 90, spe: 105 });
    });
    it("rejects more than 32 per stat or 66 total", () => {
        const base = { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 };
        assert.throws(() => championsStats(base, { hp: 33 }), /32/);
        assert.throws(() => championsStats(base, { hp: 32, atk: 32, def: 32 }), /66/);
    });
    it("rejects unknown Stat Point keys instead of ignoring them", () => {
        assert.throws(
            () => assertStatPoints({ hpp: 32 } as never),
            /Unknown stat key: hpp \(use hp\/atk\/def\/spa\/spd\/spe\)/,
        );
        assert.throws(
            () =>
                championsStats({ hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 }, {
                    spAtk: 8,
                } as never),
            /Unknown stat key: spAtk/,
        );
    });
    it("assertNature accepts real natures and rejects bogus ones", () => {
        assertNature("Adamant");
        assertNature("hardy");
        assert.throws(() => assertNature("Nope"), /Unknown nature: Nope/);
    });
});
