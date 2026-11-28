/**
 * Tests for the matchup tools (src/connector/matchup.ts), driven through an
 * MCP SDK client so every result is also checked against its output schema.
 *
 * The arithmetic comes from a library, so the suite pins results worked out by
 * hand from the game's formulas. If the library's Champions mode changes, or a
 * different version is installed, these fail instead of quietly agreeing with
 * whatever it returns.
 */
import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";

import { likelyKoHits, verdict } from "../connector/counters.js";
import { getDefaultRegulation } from "../connector/formats.js";
import type { Hit } from "../connector/matchup.js";
import { type ConnectorCallInfo, registerConnectorTools } from "../connector/register.js";
import { CONNECTOR_INFO } from "../connector/tools.js";
import { listRegulationIds } from "../regulations/registry.js";

// Usage data lives under the default regulation. A second regulation is left
// empty for the "no usage data" cases: the usage cache is shared across the
// file, so those cases must not reuse a format that has data.
const REG = getDefaultRegulation();
const STATS_FORMAT = REG.showdownFormatId as string;
const EMPTY_FORMAT = listRegulationIds().find((id) => id !== REG.id) as string;

const USAGE: Record<string, Record<string, unknown>> = {
    kingambit: {
        displayName: "Kingambit",
        usage: 0.4,
        Abilities: { defiant: 90, supremeoverlord: 10 },
        Items: { blackglasses: 50, chopleberry: 30, nothing: 20 },
        Spreads: { "Adamant:32/32/2/0/0/0": 60, "Brave:32/32/0/0/2/0": 40 },
        Moves: { suckerpunch: 95, kowtowcleave: 90, protect: 80, ironhead: 60, swordsdance: 30 },
    },
    charizardmegay: {
        displayName: "Charizard-Mega-Y",
        usage: 0.2,
        Abilities: { drought: 100 },
        Items: { charizarditey: 100 },
        Spreads: { "Timid:2/0/0/32/0/32": 100 },
        Moves: { heatwave: 95, protect: 90, solarbeam: 60 },
    },
    sneasler: {
        displayName: "Sneasler",
        usage: 0.3,
        Abilities: { unburden: 80, poisontouch: 20 },
        Items: { whiteherb: 60, focussash: 40 },
        Spreads: { "Jolly:2/32/0/0/0/32": 70, "Adamant:2/32/0/0/0/32": 30 },
        Moves: { closecombat: 99, direclaw: 80, protect: 70, fakeout: 50 },
    },
};

const env = {
    POKEMON_STATS: {
        async get(key: string) {
            if (key === REG.legalityKvKey)
                return {
                    regulationId: REG.id,
                    fetchedAt: "2026-11-27",
                    sourceUrl: "https://example.test",
                    version: 1,
                    pokemon: ["Kingambit", "Sneasler"],
                };
            if (key === `${STATS_FORMAT}:_index`) {
                return {
                    version: 2,
                    info: { "number of battles": 1000 },
                    pokemon: { Kingambit: 0.4, Sneasler: 0.3 },
                };
            }
            const [format, id] = key.split(":");
            return format === STATS_FORMAT ? (USAGE[id] ?? null) : null;
        },
    },
} as unknown as Env;

let client: Client;
const counterCalls: ConnectorCallInfo[] = [];

before(async () => {
    const server = new McpServer(CONNECTOR_INFO);
    registerConnectorTools(server, env, (info) => counterCalls.push(info));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: "matchup-tests", version: "1.0.0" });
    await client.connect(clientTransport);
    // Listing first makes the client validate every result against its output schema.
    await client.listTools();
});

async function call(name: string, args: Record<string, unknown>): Promise<any> {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { text: string }[])[0]?.text ?? "";
    return { error: result.isError ? text : null, data: result.structuredContent, text };
}

const GARCHOMP = { pokemon: "Garchomp", nature: "Jolly", statPoints: { hp: 2, atk: 32, spe: 32 } };
const KINGAMBIT = {
    pokemon: "Kingambit",
    nature: "Adamant",
    statPoints: { hp: 32, atk: 32, def: 2 },
    ability: "Defiant",
    item: "Chople Berry",
};

describe("calculate_damage", () => {
    it("matches a result worked out by hand", async () => {
        // Stats (Champions: stat = base + points + 20, HP = base + points + 75):
        //   Garchomp Atk 130 + 32 + 20 = 182 (Jolly leaves Attack alone)
        //   Kingambit HP 100 + 32 + 75 = 207, Def 120 + 2 + 20 = 142
        // Earthquake, 100 power, level 50:
        //   floor(floor(22 × 100 × 182 / 142) / 50) + 2 = 58
        //   × 0.75 for a spread move in doubles          = 43
        //   random roll 85%..100%                        = 36..43
        //   × 1.5 same-type bonus                        = 54..64
        //   × 2 (Ground into Steel)                      = 108..128
        const { data, error } = await call("calculate_damage", {
            attacker: { ...GARCHOMP, ability: "Rough Skin", item: "none" },
            defender: KINGAMBIT,
            move: "Earthquake",
        });
        assert.equal(error, null);
        assert.equal(data.attacker.stats.atk, 182);
        assert.equal(data.defender.stats.hp, 207);
        assert.equal(data.defender.stats.def, 142);
        assert.deepEqual([data.damage.min, data.damage.max], [108, 128]);
        assert.equal(data.damage.defenderHp, 207);
        assert.equal(data.damage.minPercent, 52.17);
        assert.equal(data.damage.maxPercent, 61.84);
        assert.deepEqual(data.knockOut, {
            hits: 2,
            chancePercent: 100,
            text: "guaranteed 2HKO",
        });
        assert.deepEqual(data.move, {
            name: "Earthquake",
            type: "Ground",
            category: "Physical",
            basePower: 100,
        });
        assert.ok(data.assumptions.some((line: string) => /spread move/.test(line)));
    });

    it("does full damage with a spread move when one target is left", async () => {
        // Without the 0.75: 58 → 49..58 → ×1.5 = 73..87 → ×2 = 146..174.
        const { data } = await call("calculate_damage", {
            attacker: { ...GARCHOMP, ability: "Rough Skin", item: "none" },
            defender: KINGAMBIT,
            move: "Earthquake",
            field: { singleTarget: true },
        });
        assert.deepEqual([data.damage.min, data.damage.max], [146, 174]);
        assert.ok(!data.assumptions.some((line: string) => /spread move/.test(line)));
    });

    it("applies stat stages and reports the conditions used", async () => {
        const { data } = await call("calculate_damage", {
            attacker: { ...GARCHOMP, ability: "Rough Skin", item: "none", boosts: { atk: 2 } },
            defender: KINGAMBIT,
            move: "Earthquake",
            field: { reflect: true, criticalHit: false },
        });
        assert.deepEqual(data.attacker.boosts, { atk: 2 });
        assert.deepEqual(data.conditions, ["Reflect"]);
        assert.ok(data.damage.max > 128, "+2 Attack through Reflect still beats the plain hit");
    });

    it("fills in a set from usage data and says so", async () => {
        const { data, text } = await call("calculate_damage", {
            attacker: { ...GARCHOMP, ability: "Rough Skin", item: "none" },
            defender: { pokemon: "Kingambit" },
            move: "Earthquake",
        });
        assert.equal(data.defender.nature, "Adamant");
        assert.deepEqual(data.defender.statPoints, {
            hp: 32,
            atk: 32,
            def: 2,
            spa: 0,
            spd: 0,
            spe: 0,
        });
        assert.equal(data.defender.ability, "Defiant");
        assert.equal(data.defender.item, "Black Glasses");
        const filled = data.assumptions.filter((line: string) => line.startsWith("Kingambit:"));
        assert.equal(filled.length, 3, "spread, ability and item are each called out");
        assert.match(filled.join(" "), /most common in/);
        assert.match(text, /Assumed:/);
    });

    it("falls back to a plain set, and says so, when there is no usage data", async () => {
        const { data } = await call("calculate_damage", {
            attacker: { pokemon: "Garchomp" },
            defender: { pokemon: "Kingambit" },
            move: "Earthquake",
            format: EMPTY_FORMAT,
        });
        assert.equal(data.format, EMPTY_FORMAT);
        assert.equal(data.defender.nature, "Hardy");
        assert.equal(data.defender.stats.hp, 175, "100 + 0 + 75");
        assert.equal(data.defender.item, null);
        assert.ok(data.assumptions.some((line: string) => /no usage data is available/.test(line)));
    });

    it("explains a move that does no damage instead of failing", async () => {
        const immune = await call("calculate_damage", {
            attacker: GARCHOMP,
            defender: { pokemon: "Pelipper" },
            move: "Earthquake",
            format: EMPTY_FORMAT,
        });
        assert.equal(immune.error, null);
        assert.equal(immune.data.damage.max, 0);
        assert.equal(immune.data.knockOut, undefined);
        assert.match(immune.data.noDamageReason, /immune to Ground/);

        const status = await call("calculate_damage", {
            attacker: GARCHOMP,
            defender: KINGAMBIT,
            move: "Swords Dance",
            format: EMPTY_FORMAT,
        });
        assert.match(status.data.noDamageReason, /status move/);
    });

    it("handles multi-hit moves", async () => {
        const { data, error } = await call("calculate_damage", {
            attacker: {
                pokemon: "Maushold",
                nature: "Jolly",
                statPoints: { atk: 32 },
                ability: "Technician",
                item: "none",
            },
            defender: KINGAMBIT,
            move: "Population Bomb",
        });
        assert.equal(error, null);
        assert.ok(data.damage.max > data.damage.min);
        assert.match(data.description, /10 hits/);
    });

    it("accepts Mega Evolutions and names the usage tools report", async () => {
        for (const pokemon of ["Charizard-Mega-Y", "Garchomp-Mega-Z", "Aegislash"]) {
            const { error, data } = await call("calculate_damage", {
                attacker: { pokemon },
                defender: KINGAMBIT,
                move: "Protect",
                format: EMPTY_FORMAT,
            });
            assert.equal(error, null, pokemon);
            assert.ok(data.attacker.stats.hp > 0);
            // Reported under the name that was asked for, which the other tools accept.
            assert.equal(data.attacker.pokemon, pokemon);
        }
    });

    it("uses a Mega Evolution's own ability from usage data", async () => {
        const { data } = await call("calculate_damage", {
            attacker: { pokemon: "Charizard-Mega-Y" },
            defender: KINGAMBIT,
            move: "Heat Wave",
        });
        assert.equal(data.attacker.ability, "Drought");
        assert.equal(data.attacker.item, "Charizardite Y");
    });

    it("says a real Pokémon is not in Pokémon Champions instead of suggesting spellings", async () => {
        const { error } = await call("calculate_damage", {
            attacker: { pokemon: "Mewtwo" },
            defender: KINGAMBIT,
            move: "Psychic",
        });
        assert.match(error, /Mewtwo is not in Pokémon Champions' battle data/);
        assert.doesNotMatch(error, /Did you mean/);
    });

    it("says when a Mega Stone holder is calculated before Mega Evolution", async () => {
        const { data } = await call("calculate_damage", {
            attacker: { pokemon: "Charizard", nature: "Timid", item: "Charizardite Y" },
            defender: KINGAMBIT,
            move: "Heat Wave",
        });
        assert.equal(data.attacker.pokemon, "Charizard");
        assert.ok(
            data.assumptions.some((line: string) =>
                /before Mega Evolution; name Charizard-Mega-Y/.test(line),
            ),
        );
    });

    it("rejects input it cannot calculate with a message that says what to fix", async () => {
        const overspent = await call("calculate_damage", {
            attacker: { pokemon: "Garchomp", statPoints: { hp: 32, atk: 32, spe: 32 } },
            defender: KINGAMBIT,
            move: "Earthquake",
        });
        assert.match(overspent.error, /add up to 96.*66 to spend/);

        const badMove = await call("calculate_damage", {
            attacker: GARCHOMP,
            defender: KINGAMBIT,
            move: "Earthquak",
        });
        assert.match(badMove.error, /not a move in Pokémon Champions/);

        const badNature = await call("calculate_damage", {
            attacker: { pokemon: "Garchomp", nature: "Speedy" },
            defender: KINGAMBIT,
            move: "Earthquake",
        });
        assert.match(badNature.error, /is not a nature/);

        const badPokemon = await call("calculate_damage", {
            attacker: { pokemon: "Notapokemonatall" },
            defender: KINGAMBIT,
            move: "Earthquake",
        });
        assert.ok(badPokemon.error);
    });
});

describe("compare_speed", () => {
    it("matches speeds worked out by hand, with their modifiers", async () => {
        // Garchomp Jolly, 32 Spe: floor(1.1 × (102 + 32 + 20)) = 169
        //   Choice Scarf ×1.5 = 253; Tailwind ×2 = 338; paralysis ×0.5 = 84
        // Sneasler Jolly, 32 Spe: floor(1.1 × (120 + 32 + 20)) = 189; Unburden ×2 = 378
        const fast = { nature: "Jolly", statPoints: { spe: 32 }, item: "none" };
        const { data, error } = await call("compare_speed", {
            pokemon: [
                { pokemon: "Garchomp", ...fast, ability: "Rough Skin" },
                { pokemon: "Garchomp", ...fast, ability: "Rough Skin", item: "Choice Scarf" },
                { pokemon: "Garchomp", ...fast, ability: "Rough Skin", tailwind: true },
                { pokemon: "Garchomp", ...fast, ability: "Rough Skin", status: "paralysis" },
                { pokemon: "Sneasler", ...fast, ability: "Unburden" },
                { pokemon: "Sneasler", ...fast, ability: "Unburden", abilityActive: true },
            ],
        });
        assert.equal(error, null);
        assert.deepEqual(
            data.order.map((entry: { pokemon: string; speed: number }) => [
                entry.pokemon,
                entry.speed,
            ]),
            [
                ["Sneasler", 378],
                ["Garchomp", 338],
                ["Garchomp", 253],
                ["Sneasler", 189],
                ["Garchomp", 169],
                ["Garchomp", 84],
            ],
        );
        assert.equal(data.order[0].speedStat, 189);
        assert.deepEqual(data.order[0].conditions, ["Unburden active"]);
        assert.deepEqual(data.order[1].conditions, ["Tailwind"]);
        assert.deepEqual(data.ties, []);
    });

    it("reverses the order under Trick Room and reports ties", async () => {
        const { data } = await call("compare_speed", {
            pokemon: [
                { pokemon: "Garchomp", nature: "Jolly", statPoints: { spe: 32 }, item: "none" },
                { pokemon: "Kingambit", nature: "Brave", statPoints: {}, item: "none" },
                { pokemon: "Kingambit", nature: "Brave", statPoints: {}, item: "none" },
            ],
            trickRoom: true,
        });
        // Kingambit Brave, 0 Spe: floor(0.9 × (50 + 0 + 20)) = 63
        assert.deepEqual(
            data.order.map((entry: { speed: number }) => entry.speed),
            [63, 63, 169],
        );
        assert.deepEqual(data.ties, [["Kingambit", "Kingambit"]]);
        assert.equal(data.trickRoom, true);
        assert.deepEqual(data.conditions, ["Trick Room"]);
    });

    it("applies weather Speed abilities from the weather alone", async () => {
        const set = {
            pokemon: "Basculegion",
            nature: "Hardy",
            statPoints: { spe: 32 },
            ability: "Swift Swim",
            item: "none",
        };
        const dry = await call("compare_speed", { pokemon: [set] });
        const rain = await call("compare_speed", { pokemon: [set], weather: "rain" });
        // Basculegion 78 + 32 + 20 = 130, doubled in rain.
        assert.equal(dry.data.order[0].speed, 130);
        assert.equal(rain.data.order[0].speed, 260);
    });
});

describe("check_team_threats", () => {
    const team = [
        { ...GARCHOMP, ability: "Rough Skin", item: "none", moves: ["Earthquake", "Dragon Claw"] },
    ];

    it("checks the team against the most used Pokémon", async () => {
        const { data, error, text } = await call("check_team_threats", { team });
        assert.equal(error, null);
        assert.deepEqual(
            data.threats.map((threat: { pokemon: string }) => threat.pokemon),
            ["Kingambit", "Sneasler"],
        );

        const [kingambit, sneasler] = data.threats;
        assert.equal(kingambit.usagePercent, 40);
        assert.equal(kingambit.bestAnswer.move, "Earthquake");
        assert.equal(kingambit.bestAnswer.attacker, "Garchomp");
        assert.deepEqual(kingambit.fasterTeamMembers, ["Garchomp"]);
        // Its attacks, most used first; Protect and Swords Dance are not attacks.
        assert.deepEqual(kingambit.moves, ["Sucker Punch", "Kowtow Cleave", "Iron Head"]);
        assert.equal(kingambit.biggestRisk.defender, "Garchomp");

        // Sneasler (189) outspeeds Garchomp (169).
        assert.deepEqual(sneasler.fasterTeamMembers, []);
        assert.equal(sneasler.speed, 189);
        assert.match(text, /not a battle simulation/);
    });

    it("checks named threats, including one with no usage data", async () => {
        const { data, text, error } = await call("check_team_threats", {
            team,
            threats: ["Pelipper"],
        });
        assert.equal(error, null);
        assert.equal(data.threats[0].pokemon, "Pelipper");
        assert.equal(data.threats[0].usagePercent, null);
        assert.equal(data.threats[0].biggestRisk, null, "no known attacks to check");
        assert.equal(data.threats[0].bestAnswer.move, "Dragon Claw", "Ground cannot hit it");
        assert.match(text, /No usage data for this Pokémon/);
    });

    it("calculates a weather setter's attacks under its own weather", async () => {
        const { data, text } = await call("check_team_threats", {
            team: [{ ...KINGAMBIT, moves: ["Sucker Punch"] }],
            threats: ["Charizard-Mega-Y"],
        });
        const risk = data.threats[0].biggestRisk;
        assert.equal(risk.move, "Heat Wave");
        assert.equal(risk.conditions, "Sun weather");
        assert.match(text, /in Sun weather/);

        // The same hit asked for directly, with and without sun.
        const direct = (field: Record<string, unknown>) =>
            call("calculate_damage", {
                attacker: { pokemon: "Charizard-Mega-Y" },
                defender: KINGAMBIT,
                move: "Heat Wave",
                field,
            });
        const sunny = await direct({ weather: "sun" });
        const plain = await direct({});
        assert.equal(risk.maxPercent, sunny.data.damage.maxPercent);
        assert.ok(risk.maxPercent > plain.data.damage.maxPercent);

        // The team's hit back gets no sun: Kingambit does not set it.
        assert.equal(data.threats[0].bestAnswer.conditions, undefined);
    });

    it("uses a team member's most used attacks when none are given", async () => {
        const { data } = await call("check_team_threats", {
            team: [{ pokemon: "Sneasler" }],
            threats: ["Kingambit"],
        });
        assert.deepEqual(data.team[0].moves, ["Close Combat", "Dire Claw", "Fake Out"]);
        assert.equal(data.threats[0].bestAnswer.move, "Close Combat");
        assert.ok(data.assumptions.some((line: string) => /its most used attacks/.test(line)));
    });

    it("asks for moves when it has nothing to go on", async () => {
        const { error } = await call("check_team_threats", {
            team: [{ pokemon: "Pelipper" }],
            threats: ["Kingambit"],
        });
        assert.match(error, /Pass its moves/);
    });

    it("asks for threats when the usage ranking is unavailable", async () => {
        const { error } = await call("check_team_threats", { team, format: EMPTY_FORMAT });
        assert.match(error, /Pass the threats to check/);
    });
});

const plainCounterSet = (pokemon: string, moves: string[], statPoints = {}) => ({
    pokemon,
    moves,
    nature: "Hardy",
    statPoints,
    ability: "Pressure",
    item: "none",
});

describe("find_counters", () => {
    const dragon = plainCounterSet("Garchomp", ["Dragon Claw"]);
    const fastDragon = plainCounterSet("Garchomp", ["Dragon Claw"], { spe: 32 });
    it("constructs Counter, Check, Trade and Loses with damage and Speed evidence", async () => {
        const cases = [
            {
                threat: plainCounterSet("Kingambit", ["Snarl"]),
                member: plainCounterSet("Sneasler", ["Close Combat"]),
                verdict: "Counter",
            },
            { threat: dragon, member: fastDragon, verdict: "Check" },
            { threat: dragon, member: dragon, verdict: "Trade" },
            { threat: dragon, member: plainCounterSet("Kingambit", ["Protect"]), verdict: "Loses" },
        ];
        for (const entry of cases) {
            const { data, error, text } = await call("find_counters", {
                threat: entry.threat,
                team: [entry.member],
                suggest: false,
            });
            assert.equal(error, null);
            assert.equal(data.team[0].verdict, entry.verdict);
            assert.equal(data.bestAnswer.verdict, entry.verdict);
            assert.match(text, new RegExp(entry.verdict));
            assert.match(text, /not a battle simulation/);
        }
        const { data, text } = await call("find_counters", {
            threat: dragon,
            team: [dragon],
            suggest: false,
        });
        assert.equal(data.team[0].speed.normal, "tied");
        assert.match(text, /Speed tie/);
        assert.equal(data.team[0].deals.hits, 2);
        assert.equal(data.team[0].takes.maxPercent, 76.5);
    });
    it("flips the active verdict under Trick Room", async () => {
        const { data } = await call("find_counters", {
            threat: dragon,
            team: [fastDragon],
            trickRoom: true,
            suggest: false,
        });
        assert.equal(data.team[0].normalVerdict, "Check");
        assert.equal(data.team[0].trickRoomVerdict, "Trade");
        assert.equal(data.team[0].verdict, "Trade");
        assert.equal(data.team[0].speed.trickRoom, "slower");
    });
    it("uses the usage set for a named-only threat", async () => {
        const { data, error } = await call("find_counters", {
            threat: { pokemon: "Kingambit" },
            team: [fastDragon],
            suggest: false,
        });
        assert.equal(error, null);
        assert.equal(data.threat.nature, "Adamant");
        assert.equal(data.threat.item, "Black Glasses");
        assert.deepEqual(data.threat.moves, ["Sucker Punch", "Kowtow Cleave", "Iron Head"]);
        assert.ok(data.assumptions.some((line: string) => /most common in/.test(line)));
    });
    it("suggests only when no team member answers, and honors suggest false", async () => {
        const threat = plainCounterSet("Kingambit", ["Snarl"]);
        const weak = plainCounterSet("Garchomp", ["Protect"]);
        const good = plainCounterSet("Sneasler", ["Close Combat"]);
        const noTeam = await call("find_counters", { threat });
        assert.equal(noTeam.error, null);
        assert.ok(noTeam.data.suggestions.some((row: any) => row.pokemon === "Sneasler"));
        const lacking = await call("find_counters", { threat, team: [weak], limit: 1 });
        assert.equal(lacking.data.suggestions.length, 1);
        assert.equal(lacking.data.suggestions[0].usagePercent, 30);
        const answered = await call("find_counters", { threat, team: [good] });
        assert.deepEqual(answered.data.suggestions, []);
        const disabled = await call("find_counters", { threat, team: [weak], suggest: false });
        assert.deepEqual(disabled.data.suggestions, []);
    });
    it("excludes team species and fails clearly when suggestion legality is unavailable", async () => {
        const threat = plainCounterSet("Kingambit", ["Snarl"]);
        const excluded = await call("find_counters", {
            threat,
            team: [plainCounterSet("Sneasler", ["Protect"])],
        });
        assert.equal(excluded.error, null);
        assert.ok(!excluded.data.suggestions.some((row: any) => row.pokemon === "Sneasler"));
        const calls: ConnectorCallInfo[] = [];
        const server = new McpServer(CONNECTOR_INFO);
        const noLegality = {
            POKEMON_STATS: {
                get: async (key: string) =>
                    key === REG.legalityKvKey ? null : env.POKEMON_STATS.get(key),
            },
        } as unknown as Env;
        registerConnectorTools(server, noLegality, (info) => calls.push(info));
        const [ct, st] = InMemoryTransport.createLinkedPair();
        await server.connect(st);
        const isolated = new Client({ name: "no-legality", version: "1" });
        await isolated.connect(ct);
        await isolated.listTools();
        const result = await isolated.callTool({ name: "find_counters", arguments: { threat } });
        assert.equal(result.isError, true);
        assert.equal(calls[calls.length - 1].reason, "data_unavailable");
        assert.match((result.content[0] as { text: string }).text, /suggest to false/);
        await isolated.close();
        await server.close();
    });
    it("fails unknown Pokémon with unknown_pokemon recorded by the metrics hook", async () => {
        const { error } = await call("find_counters", { threat: { pokemon: "Notapokemonatall" } });
        assert.ok(error);
        const last = counterCalls[counterCalls.length - 1];
        assert.equal(last.tool, "find_counters");
        assert.equal(last.success, false);
        assert.equal(last.reason, "unknown_pokemon");
    });
    it("rejects unknown moves and missing usage with actionable reasons", async () => {
        const unknown = await call("find_counters", {
            threat: plainCounterSet("Garchomp", ["Notamove"]),
            suggest: false,
        });
        assert.match(unknown.error, /Check the spelling/);
        assert.equal(counterCalls[counterCalls.length - 1].reason, "unknown_name");
        const absent = await call("find_counters", {
            threat: { pokemon: "Pelipper" },
            format: EMPTY_FORMAT,
            suggest: false,
        });
        assert.match(absent.error, /Pass its moves/);
        assert.equal(counterCalls[counterCalls.length - 1].reason, "no_usage");
    });
});

describe("find_counters verdict rules", () => {
    // Only the fields the verdict reads; the rest of a Hit doesn't matter here.
    const hit = (
        maxPercent: number,
        hits: number | null,
        chancePercent: number | null,
        likely = chancePercent !== null && chancePercent >= 50 ? hits : null,
    ) =>
        ({
            move: "Test",
            minPercent: maxPercent - 5,
            maxPercent,
            hits,
            chancePercent,
            likelyKoHits: likely,
        }) as Hit;

    it("counts a KO in N hits only when it is likely", () => {
        assert.equal(likelyKoHits(hit(60, 2, 100)), 2);
        assert.equal(likelyKoHits(hit(60, 2, 50)), 2);
        assert.equal(likelyKoHits(hit(48, 2, 6, 3)), 3, "a 6% 2HKO is not a 2HKO to rely on");
        assert.equal(likelyKoHits(hit(10, null, null)), Number.POSITIVE_INFINITY);
        assert.equal(likelyKoHits(hit(48, 2, 6)), Number.POSITIVE_INFINITY);
        assert.equal(likelyKoHits(hit(20, 7, null)), Number.POSITIVE_INFINITY);
    });

    it("needs strictly under half to be a Counter, so two max rolls can't KO it", () => {
        assert.equal(verdict(hit(49.9, 3, 100), hit(60, 2, 100), "slower"), "Counter");
        assert.equal(verdict(hit(50, 2, 100), hit(60, 2, 100), "slower"), "Trade");
        assert.equal(verdict(hit(50, 2, 100), hit(60, 2, 100), "faster"), "Check");
    });

    it("doesn't call a lucky-roll KO a Counter", () => {
        // KOs in two only on a 6% roll, so it really needs three.
        assert.equal(verdict(hit(30, 4, 100), hit(48, 2, 6, 3), "slower"), "Loses");
        assert.equal(verdict(hit(30, 4, 100), hit(48, 2, 6, 3), "faster"), "Check");
    });
});

describe("plan_matchup usage sets", () => {
    it("accepts names alone and lists each filled field; preserves sheet fields", async () => {
        const names = [
            "Kingambit",
            "Sneasler",
            "Charizard-Mega-Y",
            "Kingambit",
            "Sneasler",
            "Charizard-Mega-Y",
        ];
        const { data, error } = await call("plan_matchup", {
            team: names.map((pokemon) => ({ pokemon })),
            opponent: names,
        });
        assert.equal(error, null);
        assert.equal(data.matrix.length, 6);
        assert.ok(data.matrix.every((row: any[]) => row.length === 6));
        assert.equal(data.bring.indices.length, 4);
        assert.equal(data.lead.indices.length, 2);
        assert.equal(data.alternatives.length, 2);
        for (let i = 0; i < 6; i++) {
            const notes = data.assumptions
                .filter((s: string) => s.startsWith(`opponent[${i}]`))
                .join(" ");
            for (const field of [
                /nature=/,
                /statPoints=/,
                /moves=/,
                /ability was given/,
                /item was given/,
            ])
                assert.match(notes, field);
        }
        const sheet = await call("plan_matchup", {
            team: names.map((pokemon) => ({ pokemon })),
            opponent: names.map((pokemon) => ({
                pokemon,
                nature: "Hardy",
                item: "none",
                ability: "Pressure",
                moves: ["Protect"],
            })),
        });
        assert.equal(sheet.error, null);
        assert.equal(sheet.data.opponent[0].nature, "Hardy");
        assert.equal(sheet.data.opponent[0].statPoints.hp, 32);
        assert.equal(sheet.data.opponent[0].item, null);
        assert.deepEqual(sheet.data.opponent[0].moves, ["Protect"]);
    });
});
