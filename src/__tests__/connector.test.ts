/**
 * Tests for the public "VGC Teambuilder" connector surface (src/connector/).
 *
 * Every tool is exercised through a real MCP SDK client over the SDK's
 * in-memory transport, so the assertions cover what a connected client
 * actually sees: the listed metadata directory reviews scan for, and results
 * that pass the SDK's own output-schema validation at call time.
 *
 * KV and D1 are small in-memory shims with synthetic data — no network.
 */

import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getDefaultRegulation } from "../connector/formats.js";
import { type ConnectorCallInfo, registerConnectorTools } from "../connector/register.js";
import { CONNECTOR_INFO, CONNECTOR_INSTRUCTIONS, CONNECTOR_TOOLS } from "../connector/tools.js";
import { getFullLearnset, getPokemonLearnset } from "../data-loader.js";
import { listRegulationIds } from "../regulations/registry.js";
import { TOOL_REGISTRY } from "../tool-registry.js";

// --- Fixtures ---

// Fixtures hang off whichever regulation the connector currently defaults to,
// so registering a new regulation does not invalidate them.
const REG = getDefaultRegulation();
const STATS_FORMAT = REG.showdownFormatId as string;
const MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09"];

/** Usage fraction per month, oldest first. `null` = absent that month. */
const USAGE: Record<string, (number | null)[]> = {
    Kingambit: [0.3, 0.34, 0.41, 0.49],
    Sinistcha: [0.33, 0.28, 0.22, 0.15],
    Incineroar: [0.2, 0.2, 0.21, 0.2],
    Garchomp: [0.1, 0.18, 0.09, 0.2],
    Whimsicott: [null, null, 0.05, 0.12],
    Tyranitar: [0.06, 0.05, null, null],
};

const id = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");

interface UsageRow {
    format: string;
    date: string;
    pokemon_id: string;
    display_name: string;
    usage: number;
    rank: number;
    raw_count: number;
}

function buildUsageRows(): UsageRow[] {
    const rows: UsageRow[] = [];
    MONTHS.forEach((date, monthIndex) => {
        const present = Object.entries(USAGE)
            .filter(([, series]) => series[monthIndex] !== null)
            .sort(([, a], [, b]) => (b[monthIndex] as number) - (a[monthIndex] as number));
        present.forEach(([name, series], i) => {
            rows.push({
                format: STATS_FORMAT,
                date,
                pokemon_id: id(name),
                display_name: name,
                usage: series[monthIndex] as number,
                rank: i + 1,
                raw_count: 1000,
            });
        });
    });
    return rows;
}

/** Minimal D1 shim answering the four queries the connector issues. */
function makeDb(rows: UsageRow[]) {
    return {
        prepare(sql: string) {
            return {
                bind(...args: unknown[]) {
                    return {
                        async all() {
                            const [format] = args as string[];
                            const inFormat = rows.filter((r) => r.format === format);
                            if (sql.includes("FROM meta_snapshot")) {
                                const dates = [...new Set(inFormat.map((r) => r.date))].sort();
                                return { results: dates.map((date) => ({ date })) };
                            }
                            if (sql.includes("pokemon_id = ?")) {
                                const [, , pokemonId, from, to] = args as string[];
                                return {
                                    results: inFormat
                                        .filter(
                                            (r) =>
                                                r.pokemon_id === pokemonId &&
                                                r.date >= from &&
                                                r.date <= to,
                                        )
                                        .sort((a, b) => a.date.localeCompare(b.date)),
                                };
                            }
                            if (sql.includes("date = ?")) {
                                const [, , date] = args as string[];
                                return {
                                    results: inFormat
                                        .filter((r) => r.date === date)
                                        .sort((a, b) => a.rank - b.rank),
                                };
                            }
                            const [, , from, to] = args as string[];
                            return {
                                results: inFormat
                                    .filter((r) => r.date >= from && r.date <= to)
                                    .sort(
                                        (a, b) =>
                                            a.pokemon_id.localeCompare(b.pokemon_id) ||
                                            a.date.localeCompare(b.date),
                                    ),
                            };
                        },
                    };
                },
            };
        },
    };
}

function buildKv(): Map<string, unknown> {
    const latest = MONTHS.length - 1;
    const pokemon: Record<string, number> = {};
    for (const [name, series] of Object.entries(USAGE)) {
        if (series[latest] !== null) pokemon[name] = series[latest] as number;
    }
    const kv = new Map<string, unknown>();
    kv.set(`${STATS_FORMAT}:_index`, {
        info: { metagame: STATS_FORMAT, cutoff: 1630, "number of battles": 326464 },
        pokemon,
        version: 2,
    });
    kv.set(`${STATS_FORMAT}:kingambit`, {
        displayName: "Kingambit",
        usage: 0.49,
        // 1000 weighted sets in total.
        Abilities: { defiant: 990, supremeoverlord: 10 },
        Items: { chopleberry: 400, lifeorb: 350, blackglasses: 250 },
        Moves: { suckerpunch: 998, kowtowcleave: 970, ironhead: 630, protect: 600, "": 2 },
        Spreads: { "Adamant:32/32/0/0/2/0": 600, "Adamant:0/32/0/0/2/32": 400 },
        Teammates: { Basculegion: 470, Sneasler: 400, Garchomp: 360 },
        "Checks and Counters": {
            Sneasler: { n: 500, p: 0.5, d: 0.02 },
            Garchomp: { n: 400, p: 0.6, d: 0.03 },
        },
    });
    kv.set(`${STATS_FORMAT}:whimsicott`, {
        displayName: "Whimsicott",
        usage: 0.12,
        Abilities: { prankster: 100 },
        Items: { focussash: 100 },
        Moves: { tailwind: 100 },
        Spreads: {},
        Teammates: {},
    });
    kv.set(REG.legalityKvKey, {
        regulationId: REG.id,
        fetchedAt: "2026-07-03T00:00:00.000Z",
        sourceUrl: "https://example.test/pokemon.html",
        version: 1,
        pokemon: [
            "Kingambit",
            "Incineroar",
            "Garchomp",
            "Whimsicott",
            "Charizard",
            "Gardevoir",
            "Staraptor",
        ],
    });
    return kv;
}

function makeEnv(overrides: { kv?: Map<string, unknown>; rows?: UsageRow[] } = {}): Env {
    const store = overrides.kv ?? buildKv();
    return {
        POKEMON_STATS: {
            async get(key: string) {
                return store.get(key) ?? null;
            },
        },
        META_DB: makeDb(overrides.rows ?? buildUsageRows()),
    } as unknown as Env;
}

async function connect(env: Env, calls: ConnectorCallInfo[] = []) {
    const server = new McpServer(CONNECTOR_INFO, { instructions: CONNECTOR_INSTRUCTIONS });
    registerConnectorTools(server, env, (call) => calls.push(call));
    const client = new Client({ name: "connector-test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    // Listing first makes the SDK client validate every later result against
    // the advertised output schema, as a real client would.
    await client.listTools();
    return client;
}

type CallResult = {
    isError?: boolean;
    content: { type: string; text: string }[];
    // Shape differs per tool and is asserted per test.
    structuredContent?: any;
};

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
    return (await client.callTool({ name, arguments: args })) as unknown as CallResult;
}

/** Call a tool, assert it succeeded, and return its structured output. */
async function data(client: Client, name: string, args: Record<string, unknown> = {}) {
    const result = await call(client, name, args);
    assert.notEqual(result.isError, true, `${name} failed: ${result.content?.[0]?.text}`);
    assert.ok(result.structuredContent, `${name} returned no structuredContent`);
    assert.ok(result.content[0].text.length > 0, `${name} returned no text`);
    return result.structuredContent;
}

/** Call a tool, assert it reported a tool error, and return the message. */
async function errorText(client: Client, name: string, args: Record<string, unknown> = {}) {
    const result = await call(client, name, args);
    assert.equal(result.isError, true, `${name} should have failed`);
    return result.content[0].text;
}

/** Anything that would leak an internal detail into a public error. */
const INTERNAL = /bun run|scripts\/|\.ts\b|\bKV\b|\bD1\b|META_DB|showdownFormatId|docs\//;

// --- Tests ---

describe("connector tool listing", () => {
    let client: Client;
    before(async () => {
        client = await connect(makeEnv());
    });

    it("advertises the server identity and instructions", () => {
        assert.equal(client.getServerVersion()?.name, "vgc-teambuilder");
        assert.equal(client.getServerVersion()?.title, "VGC Teambuilder");
        assert.match(client.getInstructions() ?? "", /not affiliated/);
    });

    it("lists every tool with the metadata directory reviews require", async () => {
        const { tools } = await client.listTools();
        assert.deepEqual(
            tools.map((t) => t.name),
            CONNECTOR_TOOLS.map((t) => t.name),
        );
        for (const tool of tools) {
            assert.match(tool.name, /^[a-z][a-z_]{2,63}$/, `${tool.name}: name shape`);
            assert.ok(tool.title && tool.title.length > 3, `${tool.name}: title`);
            assert.ok((tool.description ?? "").length > 60, `${tool.name}: description`);
            assert.equal(tool.annotations?.title, tool.title, `${tool.name}: annotation title`);
            // OpenAI requires all three hints as explicit booleans; Anthropic
            // requires readOnlyHint or destructiveHint.
            assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name}: readOnlyHint`);
            assert.equal(tool.annotations?.destructiveHint, false, `${tool.name}: destructiveHint`);
            assert.equal(tool.annotations?.openWorldHint, false, `${tool.name}: openWorldHint`);
            assert.equal(tool.outputSchema?.type, "object", `${tool.name}: outputSchema`);
            assert.equal(tool.inputSchema.type, "object", `${tool.name}: inputSchema`);
        }
    });

    it("has unique names and no promotional wording", () => {
        const names = CONNECTOR_TOOLS.map((t) => t.name);
        assert.equal(new Set(names).size, names.length);
        for (const tool of CONNECTOR_TOOLS) {
            assert.doesNotMatch(`${tool.name} ${tool.title}`, /\b(best|official|mcp)\b/i);
        }
    });

    it("only accepts regulation ids as formats", async () => {
        const { tools } = await client.listTools();
        const format = tools.find((t) => t.name === "get_top_usage")?.inputSchema.properties
            ?.format as { enum?: string[] };
        assert.deepEqual(format.enum, listRegulationIds());
        assert.ok(format.enum?.includes(REG.id));
        const text = await errorText(client, "get_top_usage", { format: "gen9ou" });
        assert.match(text, /format/i);
    });

    it("leaves the internal Prep tool surface unchanged", () => {
        assert.deepEqual(
            TOOL_REGISTRY.map((t) => t.name),
            [
                "lookup_pokemon",
                "validate_moveset",
                "validate_team",
                "suggest_team_coverage",
                "get_usage_stats",
                "get_meta_trends",
                "query_strategy",
            ],
        );
        assert.ok(!CONNECTOR_TOOLS.some((t) => t.name === "query_strategy"));
    });
});

describe("connector data tools", () => {
    let client: Client;
    const calls: ConnectorCallInfo[] = [];
    before(async () => {
        client = await connect(makeEnv(), calls);
    });

    it("list_formats reports regulations and the default", async () => {
        const out = await data(client, "list_formats");
        assert.equal(out.defaultFormat, getDefaultRegulation().id);
        // Newest first.
        assert.deepEqual(
            out.formats.map((f: { id: string }) => f.id),
            [...listRegulationIds()].reverse(),
        );
        assert.equal(out.formats[0].bringCount, 4);
        assert.equal(out.formats[0].usageStats, true);
    });

    it("lookup_pokemon returns stats, abilities and Mega Evolutions", async () => {
        const out = await data(client, "lookup_pokemon", { pokemon: "charizard" });
        assert.equal(out.name, "Charizard");
        assert.deepEqual(out.types, ["Fire", "Flying"]);
        assert.equal(out.baseStats.total, 534);
        assert.ok(out.abilities.some((a: { hidden: boolean }) => a.hidden));
        const megaY = out.megaEvolutions.find(
            (m: { name: string }) => m.name === "Charizard-Mega-Y",
        );
        assert.equal(megaY.megaStone, "Charizardite Y");
        assert.ok(megaY.formats.includes(REG.id));
    });

    it("lookup_pokemon suggests names for a near miss", async () => {
        const text = await errorText(client, "lookup_pokemon", { pokemon: "Kingam" });
        assert.match(text, /Did you mean Kingambit/);
    });

    it("validate_moveset counts pre-evolution and base-form moves", async () => {
        // Fake Out comes from Litten; Sucker Punch from Pawniard.
        const incineroar = await data(client, "validate_moveset", {
            pokemon: "Incineroar",
            moves: ["Fake Out", "Flare Blitz", "Surf"],
        });
        assert.deepEqual(
            incineroar.moves.map((m: { learnable: boolean }) => m.learnable),
            [true, true, false],
        );
        assert.equal(incineroar.allLearnable, false);

        // Rotom-Wash's own learnset is only Hydro Pump; the rest is Rotom's.
        const rotom = await data(client, "validate_moveset", {
            pokemon: "Rotom-Wash",
            moves: ["Hydro Pump", "Thunderbolt", "Not A Move"],
        });
        assert.deepEqual(
            rotom.moves.map((m: { learnable: boolean }) => m.learnable),
            [true, true, false],
        );
        assert.match(rotom.moves[2].detail, /No move with this name/);
    });

    it("validate_team accepts a legal team and explains an illegal one", async () => {
        const legal = await data(client, "validate_team", {
            team: [
                {
                    pokemon: "Kingambit",
                    moves: ["Sucker Punch", "Kowtow Cleave", "Iron Head", "Protect"],
                    ability: "defiant",
                    item: "Chople Berry",
                },
                { pokemon: "Incineroar", moves: ["Fake Out"], item: "Sitrus Berry" },
            ],
        });
        assert.equal(legal.format, REG.id);
        assert.equal(legal.valid, true, legal.errors.join("; "));
        assert.deepEqual(legal.errors, []);

        const illegal = await data(client, "validate_team", {
            team: [
                { pokemon: "Kingambit", moves: ["Fake Out"], item: "Leftovers" },
                { pokemon: "Garchomp", item: "Leftovers" },
                { pokemon: "Mewtwo" },
                { pokemon: "Notamon" },
            ],
        });
        assert.equal(illegal.valid, false);
        assert.deepEqual(
            illegal.members.map((m: { status: string }) => m.status),
            ["allowed", "allowed", "not_allowed", "unknown"],
        );
        const errors = illegal.errors.join("\n");
        assert.match(errors, /Kingambit cannot learn Fake Out/);
        assert.match(errors, /Item Clause/);
        assert.match(errors, /Mewtwo is not legal/);
        assert.doesNotMatch(errors, INTERNAL);
    });

    it("validate_team allows several Mega Stones, with a caution", async () => {
        const out = await data(client, "validate_team", {
            team: [
                { pokemon: "Charizard", item: "Charizardite Y" },
                { pokemon: "Gardevoir", item: "Gardevoirite" },
            ],
        });
        assert.equal(out.valid, true);
        assert.match(out.warnings.join("\n"), /Mega Stones/);
    });

    it("accepts the Mega names the usage tools report", async () => {
        // In the dex and the regulation's Mega list.
        const team = await data(client, "validate_team", {
            team: [
                { pokemon: "Charizard-Mega-Y", ability: "Drought", moves: ["Heat Wave"] },
                { pokemon: "Kingambit" },
            ],
        });
        assert.equal(team.valid, true, team.errors.join("; "));
        assert.deepEqual(team.members[0], { pokemon: "Charizard-Mega-Y", status: "allowed" });

        const wrongStone = await data(client, "validate_team", {
            team: [{ pokemon: "Charizard-Mega-Y", item: "Leftovers" }],
        });
        assert.match(wrongStone.errors.join("\n"), /must hold Charizardite Y/);

        const types = await data(client, "analyze_team_types", {
            team: ["Charizard-Mega-X", "Staraptor-Mega"],
        });
        assert.deepEqual(types.team, [{ name: "Charizard-Mega-X", types: ["Fire", "Dragon"] }]);
        assert.deepEqual(types.notFound, ["Staraptor-Mega"]);

        const lookup = await data(client, "lookup_pokemon", { pokemon: "Charizard-Mega-Y" });
        assert.equal(lookup.baseSpecies, "Charizard");
        assert.equal(lookup.abilities[0].name, "Drought");
    });

    it("handles a Mega whose types and stats are still pending", async () => {
        // On the ladder and in the regulation's Mega list, but not in the dex.
        const moves = await data(client, "validate_moveset", {
            pokemon: "Staraptor-Mega",
            moves: ["Brave Bird", "Surf"],
        });
        assert.equal(moves.pokemon, "Staraptor-Mega");
        assert.deepEqual(
            moves.moves.map((m: { learnable: boolean }) => m.learnable),
            [true, false],
        );

        const lookup = await errorText(client, "lookup_pokemon", { pokemon: "Staraptor-Mega" });
        assert.match(lookup, /holding Staraptite/);
        assert.match(lookup, /base form, Staraptor/);

        // Validated as Staraptor holding Staraptite; its Mega ability is accepted.
        const team = await data(client, "validate_team", {
            team: [{ pokemon: "Staraptor-Mega", ability: "Contrary" }],
        });
        assert.equal(team.valid, true, team.errors.join("; "));
        assert.deepEqual(team.members, [{ pokemon: "Staraptor-Mega", status: "allowed" }]);
    });

    it("falls back to the base Pokémon for a Mega nothing describes", async () => {
        const moves = await data(client, "validate_moveset", {
            pokemon: "Pikachu-Mega",
            moves: ["Thunderbolt", "Hydro Pump"],
        });
        assert.deepEqual(
            moves.moves.map((m: { learnable: boolean }) => m.learnable),
            [true, false],
        );

        const lookup = await errorText(client, "lookup_pokemon", { pokemon: "Pikachu-Mega" });
        assert.match(lookup, /base form, Pikachu/);

        const team = await data(client, "validate_team", { team: [{ pokemon: "Pikachu-Mega" }] });
        assert.deepEqual(team.members, [{ pokemon: "Pikachu-Mega", status: "not_allowed" }]);
        assert.match(team.warnings.join("\n"), /checked as Pikachu/);
    });

    it("validate_team fails clearly when legality data is missing", async () => {
        const text = await errorText(client, "validate_team", {
            format: "champions-regma",
            team: [{ pokemon: "Kingambit" }],
        });
        assert.match(text, /unavailable right now/);
        assert.doesNotMatch(text, INTERNAL);
    });

    it("analyze_team_types finds shared weaknesses and useful types", async () => {
        const out = await data(client, "analyze_team_types", {
            team: ["Kingambit", "Incineroar", "Tyranitar", "Notamon"],
        });
        assert.deepEqual(out.notFound, ["Notamon"]);
        assert.equal(out.matchups.length, 18);
        // Dark/Steel, Fire/Dark and Rock/Dark are all weak to Fighting.
        assert.equal(out.sharedWeaknesses[0], "Fighting");
        const fighting = out.matchups.find((m: { type: string }) => m.type === "Fighting");
        assert.equal(fighting.weak.length, 3);
        const psychic = out.matchups.find((m: { type: string }) => m.type === "Psychic");
        assert.equal(psychic.immune.length, 3);
        assert.ok(out.suggestedTypes[0].covers.includes("Fighting"));
    });

    it("get_top_usage ranks by usage", async () => {
        const out = await data(client, "get_top_usage", { limit: 3 });
        assert.equal(out.battles, 326464);
        assert.equal(out.pokemonCount, 5);
        assert.deepEqual(out.pokemon[0], { rank: 1, name: "Kingambit", usagePercent: 49 });
        assert.equal(out.pokemon.length, 3);
    });

    it("get_pokemon_usage reports shares of sets, not of move slots", async () => {
        const out = await data(client, "get_pokemon_usage", { pokemon: "kingambit" });
        assert.equal(out.pokemon, "Kingambit");
        assert.equal(out.rank, 1);
        assert.deepEqual(out.abilities[0], { name: "Defiant", percent: 99 });
        assert.deepEqual(out.items[0], { name: "Chople Berry", percent: 40 });
        // A move on nearly every set is ~100%, not ~25% of the four move slots.
        assert.deepEqual(out.moves[0], { name: "Sucker Punch", percent: 99.8 });
        assert.equal(out.moves.length, 4, "the empty move slot is dropped");
        assert.deepEqual(out.spreads[0], {
            nature: "Adamant",
            hp: 32,
            atk: 32,
            def: 0,
            spa: 0,
            spd: 2,
            spe: 0,
            percent: 60,
        });
    });

    it("get_teammates reports the share of the Pokémon's teams", async () => {
        const out = await data(client, "get_teammates", { pokemon: "Kingambit", limit: 2 });
        assert.deepEqual(out.teammates, [
            { name: "Basculegion", percent: 47 },
            { name: "Sneasler", percent: 40 },
        ]);
    });

    it("get_checks_and_counters ranks by score", async () => {
        const out = await data(client, "get_checks_and_counters", { pokemon: "Kingambit" });
        assert.deepEqual(out.checks[0], {
            name: "Garchomp",
            score: 48,
            winRatePercent: 60,
            encounters: 400,
        });
    });

    it("usage tools explain a Pokémon with no data", async () => {
        const unused = await errorText(client, "get_pokemon_usage", { pokemon: "Magikarp" });
        assert.match(unused, /Magikarp has no recorded usage/);
        const noChecks = await errorText(client, "get_checks_and_counters", {
            pokemon: "Whimsicott",
        });
        assert.match(noChecks, /No checks-and-counters data/);
        const noMates = await errorText(client, "get_teammates", { pokemon: "Whimsicott" });
        assert.match(noMates, /No teammate data/);
    });

    it("get_usage_trend returns the monthly series", async () => {
        const out = await data(client, "get_usage_trend", { pokemon: "Kingambit" });
        assert.equal(out.from, "2026-06");
        assert.equal(out.to, "2026-09");
        assert.equal(out.points.length, 4);
        assert.deepEqual(out.points[3], { month: "2026-09", usagePercent: 49, rank: 1 });
        assert.equal(out.netChangePoints, 19);
        assert.deepEqual(out.peak, { month: "2026-09", usagePercent: 49 });
    });

    it("get_meta_shifts compares two months", async () => {
        const out = await data(client, "get_meta_shifts", { from: "2026-06", to: "2026-09" });
        assert.equal(out.risers[0].name, "Kingambit");
        assert.equal(out.risers[0].changePoints, 19);
        assert.equal(out.fallers[0].name, "Sinistcha");
        assert.deepEqual(
            out.newEntrants.map((e: { name: string }) => e.name),
            ["Whimsicott"],
        );
        assert.deepEqual(out.dropouts, [{ name: "Tyranitar", previousUsagePercent: 6 }]);
    });

    it("get_usage_momentum fits trends across the range", async () => {
        const out = await data(client, "get_usage_momentum", {});
        assert.equal(out.snapshots, 4);
        assert.equal(out.rising[0].name, "Kingambit");
        assert.equal(out.declining[0].name, "Sinistcha");
        assert.equal(out.volatile[0].name, "Garchomp");
    });

    it("trend tools explain missing history without internals", async () => {
        const unknown = await errorText(client, "get_usage_trend", { pokemon: "Magikarp" });
        assert.match(unknown, /no recorded usage/);
        const short = await errorText(client, "get_usage_momentum", { months: 2 });
        assert.match(short, /at least 4 monthly snapshots/);
        assert.match(short, /get_meta_shifts/);
        const badMonth = await errorText(client, "get_meta_shifts", { from: "June" });
        assert.match(badMonth, /YYYY-MM/);
        for (const text of [unknown, short]) assert.doesNotMatch(text, INTERNAL);
    });

    it("reports each call to the metrics hook without arguments", () => {
        assert.ok(calls.length > 10);
        assert.ok(calls.some((c) => c.tool === "get_top_usage" && c.success));
        assert.ok(calls.some((c) => c.tool === "lookup_pokemon" && !c.success));
        for (const c of calls) {
            assert.deepEqual(Object.keys(c).sort(), ["durationMs", "format", "success", "tool"]);
        }
    });
});

describe("connector with no data behind a format", () => {
    // The fixtures hold nothing for Reg M-A, which is how a regulation looks
    // before its statistics, history and legality list have been ingested.
    // (A second, empty Env would not work here: the stats modules cache by
    // format for five minutes, as they do in the Worker.)
    const format = "champions-regma";

    it("fails every data tool with an actionable, internals-free message", async () => {
        const client = await connect(makeEnv());
        const attempts: [string, Record<string, unknown>][] = [
            ["get_top_usage", { format }],
            ["get_pokemon_usage", { format, pokemon: "Kingambit" }],
            ["get_teammates", { format, pokemon: "Kingambit" }],
            ["get_checks_and_counters", { format, pokemon: "Kingambit" }],
            ["get_usage_trend", { format, pokemon: "Kingambit" }],
            ["get_meta_shifts", { format }],
            ["get_usage_momentum", { format }],
            ["validate_team", { format, team: [{ pokemon: "Kingambit" }] }],
        ];
        for (const [name, args] of attempts) {
            const text = await errorText(client, name, args);
            assert.ok(text.length > 30, `${name}: message too short`);
            assert.doesNotMatch(text, INTERNAL, `${name}: leaks internals`);
        }
    });

    it("turns an unexpected failure into a generic tool error", async () => {
        const env = makeEnv();
        const db = env.META_DB;
        (env as unknown as { META_DB: unknown }).META_DB = {
            prepare(sql: string) {
                if (sql.includes("pokemon_id = ?")) throw new Error("D1_ERROR: boom");
                return db.prepare(sql);
            },
        };
        const client = await connect(env);
        const text = await errorText(client, "get_usage_trend", { pokemon: "Kingambit" });
        assert.match(text, /try again/i);
        assert.doesNotMatch(text, /boom|D1/);
    });
});

describe("getFullLearnset", () => {
    it("adds pre-evolution moves the species' own entry lacks", () => {
        assert.equal(getPokemonLearnset("Kingambit")?.learnset?.suckerpunch, undefined);
        assert.ok(getFullLearnset("Kingambit")?.suckerpunch);
        assert.ok(getFullLearnset("Incineroar")?.fakeout.includes("9E"));
    });

    it("uses the base species for formes without a learnset", () => {
        assert.equal(getPokemonLearnset("Landorus-Therian")?.learnset, undefined);
        assert.ok(getFullLearnset("Landorus-Therian")?.earthpower);
        assert.ok(getFullLearnset("Charizard-Mega-Y")?.heatwave);
    });

    it("does not give regional forms their base form's moves", () => {
        // Alolan Ninetales inherits from Alolan Vulpix, not Kantonian Ninetales.
        assert.equal(getFullLearnset("Ninetales-Alola")?.flamethrower, undefined);
        assert.ok(getFullLearnset("Ninetales-Alola")?.blizzard);
    });

    it("returns undefined for unknown Pokémon", () => {
        assert.equal(getFullLearnset("Notamon"), undefined);
    });
});
