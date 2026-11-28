import { strict as assert } from "node:assert";
import { it } from "node:test";
import { findCounters, likelyKoHits } from "../connector/counters.js";
import { getDefaultRegulation } from "../connector/formats.js";
import * as matchup from "../connector/matchup.js";

const plain = (pokemon: string, moves: string[]) => ({
    pokemon,
    moves,
    nature: "Hardy",
    statPoints: {},
    ability: "Pressure",
    item: "none",
});
const resultData = (result: any): any => {
    assert.equal(result.ok, true);
    return result.data ?? result.structuredContent;
};

it("does not invent a KO through Leftovers recovery", async () => {
    const result = await findCounters(
        {
            threat: { ...plain("Aggron", ["Protect"]), item: "Leftovers" },
            team: [plain("Sneasler", ["Quick Attack"])],
            suggest: false,
        },
        {} as Env,
    );
    const row = resultData(result).team[0];
    assert.equal(row.verdict, "Loses");
    assert.equal(row.deals.hits, null);
    assert.equal(likelyKoHits(row.deals), Number.POSITIVE_INFINITY);
});

it("computes likely hits for a possible 7HKO with unknown probability", async () => {
    const result = await findCounters(
        {
            threat: plain("Kingambit", ["Snarl"]),
            team: [plain("Gardevoir-Mega", ["Hyper Voice"])],
            suggest: false,
        },
        {} as Env,
    );
    const row = resultData(result).team[0];
    assert.equal(row.deals.hits, 7);
    assert.equal(row.deals.chancePercent, null);
    assert.equal(likelyKoHits(row.deals), 8);
});

it("evaluates alternate forms before deduplicating suggestions", async () => {
    const reg = getDefaultRegulation();
    const usage = (ability: string, move: string) => ({
        displayName: "Gardevoir",
        Abilities: { [ability]: 100 },
        Items: { nothing: 100 },
        Spreads: { "Hardy:0/0/0/0/0/0": 100 },
        Moves: { [move]: 100 },
    });
    const env = {
        POKEMON_STATS: {
            get: async (key: string) => {
                if (key === reg.legalityKvKey)
                    return {
                        regulationId: reg.id,
                        fetchedAt: "2026-11-27",
                        sourceUrl: "https://example.test",
                        version: 1,
                        pokemon: ["Gardevoir"],
                    };
                if (key.endsWith(":_index"))
                    return {
                        version: 2,
                        info: { "number of battles": 1000 },
                        pokemon: { Gardevoir: 0.2, "Gardevoir-Mega": 0.1 },
                    };
                if (key.endsWith(":gardevoir")) return usage("synchronize", "psychic");
                if (key.endsWith(":gardevoirmega")) return usage("pixilate", "hypervoice");
                return null;
            },
        },
    } as unknown as Env;
    const data = resultData(await findCounters({ threat: plain("Kingambit", ["Snarl"]) }, env));
    assert.deepEqual(
        data.suggestions.map((row: any) => [row.pokemon, row.verdict]),
        [["Gardevoir-Mega", "Counter"]],
    );
});

it("convolves rolls rather than assuming the next count is likely", () => {
    assert.equal(matchup.likelyDamageKoHits([1, 2], 4), 3);
    assert.equal(
        matchup.likelyDamageKoHits(
            [
                [1, 2],
                [1, 2],
            ],
            4,
        ),
        2,
    );
    assert.equal(matchup.likelyDamageKoHits(1, 10), null);
    // Duplicate rolls retain their weights: 2-hit KO chance is 1/16 here.
    assert.equal(matchup.likelyDamageKoHits([1, 1, 1, 2], 4), 3);
});

it("requires an unrounded numeric calc probability for residual or recovery effects", () => {
    const base = {
        damage: Array(16).fill(60),
        defender: { curHP: () => 100 },
        attacker: {},
        field: {},
        move: { name: "Test" },
    };
    for (const patch of [
        { defender: { ...base.defender, item: "Leftovers" } },
        { defender: { ...base.defender, item: "Black Sludge" } },
        { field: { terrain: "Grassy" } },
        { field: { weather: "Sand" } },
        { field: { defenderSide: { isSeeded: true } } },
    ]) {
        const result = { ...base, ...patch };
        assert.equal(
            matchup.likelyResultKoHits(result, { n: 2, chance: null, text: "possible 2HKO" }),
            null,
        );
        assert.equal(matchup.likelyResultKoHits(result, { n: 2, chance: 0.49999, text: "" }), null);
        assert.equal(matchup.likelyResultKoHits(result, { n: 2, chance: 0.5, text: "" }), 2);
        assert.equal(matchup.likelyResultKoHits(result, { n: 0, chance: 0, text: "" }), null);
    }
    assert.equal(
        matchup.likelyResultKoHits(base, {
            n: 2,
            chance: null,
            text: "possible 2HKO after recovery",
        }),
        null,
    );
    assert.equal(
        matchup.likelyResultKoHits(
            {
                ...base,
                damage: [
                    [1, 2],
                    [1, 2],
                ],
                defender: { curHP: () => 4 },
            },
            { n: 1, chance: null, text: "" },
        ),
        2,
    );
    assert.equal(
        matchup.likelyResultKoHits(
            { ...base, damage: [2, 2], defender: { curHP: () => 4 } },
            { n: 1, chance: 1, text: "" },
        ),
        1,
    );
});
