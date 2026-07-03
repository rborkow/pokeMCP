/**
 * Tests for the Regulation M-B Mega registry (derived from the Champions
 * dataset) and its integration with the Omni Ring helpers.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { CHAMPIONS_REGMB } from "../regulations/champions-regmb.js";
import { CHAMPIONS_REGMB_MEGAS } from "../regulations/mega-data.js";
import { findMegaFormForItem, isChampionsMegaStone } from "../regulations/mega-helpers.js";

describe("CHAMPIONS_REGMB_MEGAS", () => {
    const byName = new Map(CHAMPIONS_REGMB_MEGAS.map((m) => [m.megaName, m]));

    it("is wired to the M-B regulation and far broader than M-A's eight", () => {
        assert.equal(CHAMPIONS_REGMB.megaForms, CHAMPIONS_REGMB_MEGAS);
        // M-B enables the Mega of every roster Pokémon that has one (66 as of
        // 2026-07). Keep a lower bound so a data refresh doesn't silently gut it.
        assert.ok(
            CHAMPIONS_REGMB_MEGAS.length >= 60,
            `expected >= 60 Megas, got ${CHAMPIONS_REGMB_MEGAS.length}`,
        );
    });

    it("includes the canonical new M-B Megas with correct trigger stones", () => {
        const expected: [string, string, string[]][] = [
            ["Blaziken-Mega", "Blazikenite", ["Fire", "Fighting"]],
            ["Sceptile-Mega", "Sceptilite", ["Grass", "Dragon"]],
            ["Swampert-Mega", "Swampertite", ["Water", "Ground"]],
            ["Mawile-Mega", "Mawilite", ["Steel", "Fairy"]],
            ["Metagross-Mega", "Metagrossite", ["Steel", "Psychic"]],
        ];
        for (const [name, stone, types] of expected) {
            const form = byName.get(name);
            assert.ok(form, `missing ${name}`);
            assert.equal(form?.megaStone, stone);
            assert.deepEqual(form?.postMegaTypes, types);
        }
    });

    it("includes Champions-exclusive Megas with their real (non-guessed) stones", () => {
        // Scrafty's Champions stone is "Scraftinite", NOT the "Scraftyite" that
        // name-generating third-party lists assume.
        assert.equal(byName.get("Scrafty-Mega")?.megaStone, "Scraftinite");
        // Meganium-Mega now carries full post-Mega data (pending under M-A).
        assert.ok(byName.get("Meganium-Mega")?.postMegaBaseStats);
    });

    it("excludes Megas of restricted Legendaries not on the M-B roster", () => {
        for (const name of [
            "Mewtwo-Mega-X",
            "Mewtwo-Mega-Y",
            "Salamence-Mega",
            "Latios-Mega",
            "Latias-Mega",
            "Diancie-Mega",
            "Zygarde-Mega",
        ]) {
            assert.equal(byName.has(name), false, `${name} should be excluded`);
        }
    });

    it("has complete, unique data for every entry", () => {
        for (const m of CHAMPIONS_REGMB_MEGAS) {
            assert.ok(m.basePokemon && m.megaName && m.megaStone, `incomplete: ${m.megaName}`);
            assert.ok(m.postMegaTypes?.length, `no types: ${m.megaName}`);
            assert.ok(m.postMegaAbility, `no ability: ${m.megaName}`);
            assert.ok(m.postMegaBaseStats, `no stats: ${m.megaName}`);
        }
        const stones = CHAMPIONS_REGMB_MEGAS.map((m) => m.megaStone);
        assert.equal(new Set(stones).size, stones.length, "duplicate Mega Stones");
    });
});

describe("Omni Ring helpers recognize M-B Mega Stones", () => {
    it("recognizes new M-B stones the M-A list lacked", () => {
        // These were absent while M-B reused CHAMPIONS_REGMA_MEGAS, so a team
        // holding two of them would not have tripped the one-Mega rule.
        assert.equal(isChampionsMegaStone("Blazikenite", CHAMPIONS_REGMB.megaForms), true);
        assert.equal(isChampionsMegaStone("Scraftinite", CHAMPIONS_REGMB.megaForms), true);
        const form = findMegaFormForItem("Scraftinite", CHAMPIONS_REGMB.megaForms);
        assert.equal(form?.megaName, "Scrafty-Mega");
    });

    it("still recognizes returning M-A stones and rejects non-stones", () => {
        assert.equal(isChampionsMegaStone("Gengarite", CHAMPIONS_REGMB.megaForms), true);
        assert.equal(isChampionsMegaStone("Sitrus Berry", CHAMPIONS_REGMB.megaForms), false);
        // Excluded Legendary's stone must not be recognized.
        assert.equal(isChampionsMegaStone("Salamencite", CHAMPIONS_REGMB.megaForms), false);
    });
});
