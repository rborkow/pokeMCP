/**
 * Tests for the Phase 3a Mega data module and the Omni Ring validator rule.
 *
 * We exercise:
 *   - MegaForm shape: post-Mega fields populated for the seven returning
 *     Gen 6/7 Megas; championsExclusive set on Meganium-Mega.
 *   - isChampionsMegaStone() / findMegaFormForItem() resolve by item name.
 *   - Validator rejects a team holding two different Mega Stones, but
 *     accepts a team holding exactly one.
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { CHAMPIONS_REGMA } from "../regulations/champions-regma.js";
import { loadRegulation } from "../regulations/loader.js";
import { CHAMPIONS_REGMA_MEGAS } from "../regulations/mega-data.js";
import { findMegaFormForItem, isChampionsMegaStone } from "../regulations/mega-helpers.js";
import type { LegalityKvBlob } from "../regulations/types.js";
import { validateTeamForRegulation } from "../regulations/validator.js";
import type { TeamPokemon } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "fixtures", "champions-regma-legality.json");
const LEGALITY_BLOB = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")) as LegalityKvBlob;

function makeEnvWithLegality(blob: LegalityKvBlob): Env {
    const store = new Map<string, string>([[CHAMPIONS_REGMA.legalityKvKey, JSON.stringify(blob)]]);
    return {
        POKEMON_STATS: {
            async get(key: string, type?: string) {
                const raw = store.get(key);
                if (raw === undefined) return null;
                return type === "json" ? JSON.parse(raw) : raw;
            },
        },
    } as unknown as Env;
}

describe("CHAMPIONS_REGMA_MEGAS shape", () => {
    it("includes the seven returning Gen 6/7 Megas with full post-Mega data", () => {
        const returning = [
            "Charizard-Mega-X",
            "Charizard-Mega-Y",
            "Gengar-Mega",
            "Lucario-Mega",
            "Kangaskhan-Mega",
            "Gyarados-Mega",
            "Gardevoir-Mega",
        ];
        for (const name of returning) {
            const form = CHAMPIONS_REGMA_MEGAS.find((f) => f.megaName === name);
            assert.ok(form, `missing ${name}`);
            assert.ok(
                form!.postMegaTypes && form!.postMegaTypes.length > 0,
                `${name} missing types`,
            );
            assert.ok(form!.postMegaAbility, `${name} missing ability`);
            assert.ok(form!.postMegaBaseStats, `${name} missing stats`);
            assert.ok(!form!.championsExclusive, `${name} should not be championsExclusive`);
        }
    });

    it("marks Meganium-Mega as championsExclusive with pending data", () => {
        const meganium = CHAMPIONS_REGMA_MEGAS.find((f) => f.megaName === "Meganium-Mega");
        assert.ok(meganium, "Meganium-Mega missing");
        assert.equal(meganium!.championsExclusive, true);
        assert.equal(meganium!.postMegaTypes, undefined);
        assert.equal(meganium!.postMegaAbility, undefined);
        assert.equal(meganium!.postMegaBaseStats, undefined);
    });

    it("uses Reg M-A mega list on the regulation", () => {
        assert.equal(CHAMPIONS_REGMA.megaForms, CHAMPIONS_REGMA_MEGAS);
    });
});

describe("mega-helpers", () => {
    it("isChampionsMegaStone matches by normalised item name", () => {
        assert.equal(isChampionsMegaStone("Charizardite X", "champions-regma"), true);
        assert.equal(isChampionsMegaStone("charizardite x", "champions-regma"), true);
        assert.equal(isChampionsMegaStone("Life Orb", "champions-regma"), false);
        assert.equal(isChampionsMegaStone(undefined, "champions-regma"), false);
    });

    it("findMegaFormForItem returns the matching form", () => {
        const form = findMegaFormForItem("Gardevoirite", "champions-regma");
        assert.ok(form);
        assert.equal(form!.megaName, "Gardevoir-Mega");
    });

    it("findMegaFormForItem returns undefined for unknown items", () => {
        assert.equal(findMegaFormForItem("Leftovers", "champions-regma"), undefined);
    });

    it("accepts a MegaForm[] directly (no registry lookup required)", () => {
        assert.equal(isChampionsMegaStone("Gengarite", CHAMPIONS_REGMA_MEGAS), true);
    });
});

describe("validator — Omni Ring (one Mega per team)", () => {
    it("accepts a team with exactly one Mega Stone", async () => {
        const env = makeEnvWithLegality(LEGALITY_BLOB);
        const loaded = await loadRegulation(CHAMPIONS_REGMA, env);
        const team: TeamPokemon[] = [
            {
                pokemon: "Garchomp",
                moves: ["Earthquake"],
                item: "Charizardite X",
            },
            {
                pokemon: "Incineroar",
                moves: ["Flare Blitz"],
                item: "Assault Vest",
            },
        ];
        const result = validateTeamForRegulation(team, loaded);
        const megaErrors = result.errors.filter((e) => e.includes("Omni Ring"));
        assert.equal(megaErrors.length, 0, `unexpected Omni Ring error: ${megaErrors.join(", ")}`);
    });

    it("rejects a team holding two different Mega Stones", async () => {
        const env = makeEnvWithLegality(LEGALITY_BLOB);
        const loaded = await loadRegulation(CHAMPIONS_REGMA, env);
        const team: TeamPokemon[] = [
            {
                pokemon: "Garchomp",
                moves: ["Earthquake"],
                item: "Charizardite X",
            },
            {
                pokemon: "Amoonguss",
                moves: ["Spore"],
                item: "Gardevoirite",
            },
        ];
        const result = validateTeamForRegulation(team, loaded);
        assert.equal(result.ok, false);
        assert.ok(
            result.errors.some((e) => e.includes("Omni Ring")),
            `expected Omni Ring error, got: ${JSON.stringify(result.errors)}`,
        );
    });

    it("accepts a team with no Mega Stones", async () => {
        const env = makeEnvWithLegality(LEGALITY_BLOB);
        const loaded = await loadRegulation(CHAMPIONS_REGMA, env);
        const team: TeamPokemon[] = [
            {
                pokemon: "Garchomp",
                moves: ["Earthquake"],
                item: "Life Orb",
            },
        ];
        const result = validateTeamForRegulation(team, loaded);
        const megaErrors = result.errors.filter((e) => e.includes("Omni Ring"));
        assert.equal(megaErrors.length, 0);
    });
});
