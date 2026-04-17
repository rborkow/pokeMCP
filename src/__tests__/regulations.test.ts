/**
 * Tests for the Champions regulation abstraction and validator.
 *
 * Uses node:test + tsx so the suite runs with zero additional dependencies:
 *   npm run test
 *
 * The Champions legality blob is loaded from a fixture; we do not hit the
 * live web-view URL in tests. The Env is stubbed with an in-memory KV shim.
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { CHAMPIONS_REGMA } from "../regulations/champions-regma.js";
import { LegalityNotIngestedError, loadRegulation } from "../regulations/loader.js";
import { getRegulation, isRegulationId } from "../regulations/registry.js";
import {
    validateTeamForRegulation,
    validateTeamForRegulationId,
} from "../regulations/validator.js";
import type { LegalityKvBlob } from "../regulations/types.js";
import type { TeamPokemon } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "fixtures", "champions-regma-legality.json");
const LEGALITY_BLOB = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")) as LegalityKvBlob;

function makeEnvWithLegality(blob: LegalityKvBlob | null): Env {
    const store = new Map<string, string>();
    if (blob) store.set(CHAMPIONS_REGMA.legalityKvKey, JSON.stringify(blob));
    const kv = {
        async get(key: string, type?: string) {
            const raw = store.get(key);
            if (raw === undefined) return null;
            return type === "json" ? JSON.parse(raw) : raw;
        },
    };
    return { POKEMON_STATS: kv } as unknown as Env;
}

// Moves are kept minimal and drawn from bread-and-butter learnsets to keep the
// fixtures robust against Showdown learnset nuances. This test cares about
// regulation rules, not learnset edge cases — broader moveset validation is
// exercised by the existing Showdown-format tests.
const LEGAL_TEAM: TeamPokemon[] = [
    {
        pokemon: "Garchomp",
        moves: ["Earthquake", "Dragon Claw"],
        ability: "Rough Skin",
        item: "Life Orb",
    },
    {
        pokemon: "Incineroar",
        moves: ["Flare Blitz", "Knock Off"],
        ability: "Intimidate",
        item: "Assault Vest",
    },
    {
        pokemon: "Amoonguss",
        moves: ["Spore", "Pollen Puff"],
        ability: "Regenerator",
        item: "Sitrus Berry",
    },
    {
        pokemon: "Rillaboom",
        moves: ["Wood Hammer", "Grassy Glide"],
        ability: "Grassy Surge",
        item: "Miracle Seed",
    },
];

describe("regulation registry", () => {
    it("recognises champions-regma", () => {
        assert.equal(isRegulationId("champions-regma"), true);
        assert.equal(isRegulationId("gen9vgc2026regf"), false);
    });

    it("returns the Reg M-A definition", () => {
        const reg = getRegulation("champions-regma");
        assert.ok(reg);
        assert.equal(reg!.id, "champions-regma");
        assert.equal(reg!.platform, "champions");
        assert.equal(reg!.level, 50);
        assert.equal(reg!.teamSize, 6);
        assert.equal(reg!.bringCount, 4);
        assert.equal(reg!.enforceSpeciesClause, true);
        assert.equal(reg!.enforceItemClause, true);
    });
});

describe("loadRegulation", () => {
    it("hydrates the allow-list from KV", async () => {
        const env = makeEnvWithLegality(LEGALITY_BLOB);
        const loaded = await loadRegulation(CHAMPIONS_REGMA, env);
        assert.equal(loaded.allowedPokemonDisplay.length, LEGALITY_BLOB.pokemon.length);
        assert.equal(loaded.allowedPokemonIds.has("garchomp"), true);
        assert.equal(loaded.allowedPokemonIds.has("greattusk"), true);
        // Misspelt / absent species must not be in the set.
        assert.equal(loaded.allowedPokemonIds.has("zacian"), false);
    });

    it("fails loudly when KV data is missing — never falls back to empty list", async () => {
        const env = makeEnvWithLegality(null);
        await assert.rejects(
            () => loadRegulation(CHAMPIONS_REGMA, env),
            (err: unknown) => err instanceof LegalityNotIngestedError,
        );
    });

    it("fails loudly when KV data is malformed", async () => {
        const env = makeEnvWithLegality({
            regulationId: "champions-regma",
            // Wrong shape: pokemon is not an array
            pokemon: "not-an-array" as unknown as string[],
            fetchedAt: "now",
            sourceUrl: "x",
            version: 1,
        } as LegalityKvBlob);
        await assert.rejects(
            () => loadRegulation(CHAMPIONS_REGMA, env),
            (err: unknown) => err instanceof LegalityNotIngestedError,
        );
    });
});

describe("validateTeamForRegulation", () => {
    it("accepts a legal Reg M-A team", async () => {
        const env = makeEnvWithLegality(LEGALITY_BLOB);
        const loaded = await loadRegulation(CHAMPIONS_REGMA, env);
        const result = validateTeamForRegulation(LEGAL_TEAM, loaded);
        assert.equal(result.ok, true, `expected legal; errors: ${result.errors.join(", ")}`);
        assert.equal(result.errors.length, 0);
    });

    it("rejects a team containing a Pokémon not on the allow-list", async () => {
        const env = makeEnvWithLegality(LEGALITY_BLOB);
        const loaded = await loadRegulation(CHAMPIONS_REGMA, env);
        const team: TeamPokemon[] = [
            ...LEGAL_TEAM.slice(0, 3),
            {
                // Zacian is not in the Reg M-A fixture allow-list.
                pokemon: "Zacian",
                moves: ["Behemoth Blade", "Play Rough", "Close Combat", "Protect"],
                ability: "Intrepid Sword",
                item: "Rusted Sword",
            },
        ];
        const result = validateTeamForRegulation(team, loaded);
        assert.equal(result.ok, false);
        assert.ok(
            result.errors.some(
                (e) => e.includes("Zacian") && e.toLowerCase().includes("not legal"),
            ),
            `expected allow-list error, got: ${JSON.stringify(result.errors)}`,
        );
    });

    it("enforces the Item Clause", async () => {
        const env = makeEnvWithLegality(LEGALITY_BLOB);
        const loaded = await loadRegulation(CHAMPIONS_REGMA, env);
        const team: TeamPokemon[] = [
            {
                pokemon: "Garchomp",
                moves: ["Earthquake", "Dragon Claw", "Protect", "Stone Edge"],
                item: "Life Orb",
            },
            {
                pokemon: "Dragapult",
                moves: ["Dragon Darts", "Phantom Force", "U-turn", "Draco Meteor"],
                item: "Life Orb",
            },
        ];
        const result = validateTeamForRegulation(team, loaded);
        assert.equal(result.ok, false);
        assert.ok(
            result.errors.some((e) => e.includes("Item Clause")),
            `expected item clause error, got: ${JSON.stringify(result.errors)}`,
        );
    });

    it("enforces the 4-move cap", async () => {
        const env = makeEnvWithLegality(LEGALITY_BLOB);
        const loaded = await loadRegulation(CHAMPIONS_REGMA, env);
        const team: TeamPokemon[] = [
            {
                pokemon: "Garchomp",
                moves: ["Earthquake", "Dragon Claw", "Protect", "Stone Edge", "Fire Fang"],
            },
        ];
        const result = validateTeamForRegulation(team, loaded);
        assert.equal(result.ok, false);
        assert.ok(
            result.errors.some((e) => e.includes("moves")),
            `expected move-cap error, got: ${JSON.stringify(result.errors)}`,
        );
    });

    it("enforces 6-Pokémon max", async () => {
        const env = makeEnvWithLegality(LEGALITY_BLOB);
        const loaded = await loadRegulation(CHAMPIONS_REGMA, env);
        const team: TeamPokemon[] = Array.from({ length: 7 }, () => ({
            pokemon: "Garchomp",
            moves: ["Earthquake"],
        }));
        const result = validateTeamForRegulation(team, loaded);
        assert.equal(result.ok, false);
        assert.ok(result.errors.some((e) => e.includes("max 6")));
    });

    it("warns (not errors) when level is not 50", async () => {
        const env = makeEnvWithLegality(LEGALITY_BLOB);
        const loaded = await loadRegulation(CHAMPIONS_REGMA, env);
        const team: TeamPokemon[] = [{ pokemon: "Garchomp", moves: ["Earthquake"], level: 100 }];
        const result = validateTeamForRegulation(team, loaded);
        assert.ok(
            result.warnings.some((w) => w.includes("level 100")),
            `expected level warning, got: ${JSON.stringify(result.warnings)}`,
        );
    });
});

describe("validateTeamForRegulationId (KV-loading entry point)", () => {
    it("returns a user-friendly error instead of throwing when KV is empty", async () => {
        const env = makeEnvWithLegality(null);
        const res = await validateTeamForRegulationId(LEGAL_TEAM, "champions-regma", env);
        assert.equal(res.kind, "error");
        if (res.kind === "error") {
            assert.match(res.message, /not been ingested|not available in KV/);
            assert.ok(
                !res.message.toLowerCase().includes("empty allow-list") ||
                    res.message.includes("Refusing"),
                "error must make clear we are not silently allowing teams",
            );
        }
    });

    it("returns a validated result when legality is present", async () => {
        const env = makeEnvWithLegality(LEGALITY_BLOB);
        const res = await validateTeamForRegulationId(LEGAL_TEAM, "champions-regma", env);
        assert.equal(res.kind, "validated");
        if (res.kind === "validated") {
            assert.equal(res.result.ok, true);
        }
    });
});
