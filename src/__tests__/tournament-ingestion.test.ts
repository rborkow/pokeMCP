/**
 * Tests for the daily tournament ingestion (src/tournaments/ingestion.ts).
 *
 * Selection, regulation mapping and the ladder comparison are pure functions.
 * The end-to-end test runs the whole job against a stubbed Limitless API and
 * in-memory D1 and KV shims — no network.
 */

import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";

import {
    type ApiTournamentSummary,
    ladderUsageBySpecies,
    refreshTournamentNewsroom,
    regulationForFormat,
    selectCandidates,
} from "../tournaments/ingestion.js";

const NOW = Date.parse("2026-11-12T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1_000).toISOString();

const event = (
    id: string,
    overrides: Partial<ApiTournamentSummary> = {},
): ApiTournamentSummary => ({
    id,
    game: "VGC",
    format: "M-C",
    name: `Event ${id}`,
    date: daysAgo(1),
    players: 64,
    ...overrides,
});

describe("regulationForFormat", () => {
    it("uses the registry for a registered regulation", () => {
        const regulation = regulationForFormat("M-C");
        assert.equal(regulation?.id, "champions-regmc");
        assert.equal(regulation?.label, "Pokémon Champions — Regulation M-C");
        assert.equal(regulation?.statsFormat, "gen9championsvgc2026regmc");
    });

    it("accepts a Champions regulation the registry does not know yet", () => {
        // The results page must not freeze when a regulation starts before it is registered.
        const regulation = regulationForFormat("M-Z");
        assert.deepEqual(regulation, {
            id: "champions-regmz",
            label: "Pokémon Champions — Regulation M-Z",
        });
    });

    it("rejects formats that are not Champions regulations", () => {
        for (const format of ["CUSTOM", "", "SVI", "M-", "m-c", "M-CC"]) {
            assert.equal(regulationForFormat(format), null, format);
        }
    });
});

describe("selectCandidates", () => {
    it("keeps recent, large, completed Champions events that are not stored yet", () => {
        const picked = selectCandidates(
            [
                event("keep"),
                event("stored"),
                event("small", { players: 47 }),
                event("old", { date: daysAgo(36) }),
                event("future", { date: daysAgo(-1) }),
                event("custom", { format: "CUSTOM" }),
                event("edge", { date: daysAgo(35), players: 48 }),
            ],
            new Set(["stored"]),
            NOW,
        );
        assert.deepEqual(
            picked.map((e) => e.id),
            ["keep", "edge"],
        );
    });

    it("takes the newest events first, across regulations, up to the cap", () => {
        const picked = selectCandidates(
            [
                event("older", { date: daysAgo(9), format: "M-B" }),
                event("newest", { date: daysAgo(1) }),
                event("middle", { date: daysAgo(4) }),
            ],
            new Set(),
            NOW,
            2,
        );
        assert.deepEqual(
            picked.map((e) => e.id),
            ["newest", "middle"],
        );
    });

    it("ignores an event listed twice", () => {
        const picked = selectCandidates([event("a"), event("a")], new Set(), NOW);
        assert.equal(picked.length, 1);
    });
});

describe("ladderUsageBySpecies", () => {
    it("adds a species' Mega entries to its plain entry", () => {
        const usage = ladderUsageBySpecies({
            Charizard: 0.02,
            "Charizard-Mega-Y": 0.21,
            "Charizard-Mega-X": 0.01,
            "Staraptor-Mega": 0.08,
            "Ninetales-Alola": 0.05,
            Ninetales: 0.01,
        });
        assert.equal(usage.get("charizard")?.toFixed(2), "0.24");
        assert.equal(usage.get("staraptor"), 0.08);
        // Regional forms are different Pokémon and stay separate.
        assert.equal(usage.get("ninetalesalola"), 0.05);
        assert.equal(usage.get("ninetales"), 0.01);
    });
});

describe("refreshTournamentNewsroom", () => {
    const lastStatement = (db: { statements: { sql: string; args: unknown[] }[] }) =>
        db.statements[db.statements.length - 1];

    const realFetch = globalThis.fetch;
    afterEach(() => {
        globalThis.fetch = realFetch;
    });

    /** D1 shim that records statements and answers the two reads the job makes. */
    function makeDb(storedIds: string[] = []) {
        const statements: { sql: string; args: unknown[] }[] = [];
        const statement = (sql: string, args: unknown[] = []) => ({
            sql,
            args,
            bind: (...bound: unknown[]) => statement(sql, bound),
            run: async () => {
                statements.push({ sql, args });
                return {};
            },
            all: async () => ({ results: storedIds.map((id) => ({ id })) }),
        });
        return {
            statements,
            prepare: (sql: string) => statement(sql),
            batch: async (batch: { sql: string; args: unknown[] }[]) => {
                for (const s of batch) statements.push({ sql: s.sql, args: s.args });
                return [];
            },
        };
    }

    const standings = (names: string[][]) =>
        names.map((team, i) => ({
            placing: i + 1,
            name: `Player ${i + 1}`,
            record: { wins: 7 - i, losses: i, ties: 0 },
            decklist: team.map((name) => ({
                // Limitless names alternate forms its own way; the id is Showdown-shaped.
                id: name === "Hisuian Arcanine" ? "arcanine-hisui" : name.toLowerCase(),
                name,
                attacks: ["Protect"],
            })),
        }));

    const TEAM_A = ["Charizard", "Rillaboom", "Incineroar", "Kingambit"];
    const TEAM_B = ["Charizard", "Sneasler", "Garchomp", "Hisuian Arcanine"];

    function stubLimitless(options: { rateLimitOn?: string } = {}) {
        const requested: string[] = [];
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            const url = String(input);
            requested.push(url.replace("https://play.limitlesstcg.com/api", ""));
            const json = (body: unknown, status = 200) =>
                new Response(JSON.stringify(body), {
                    status,
                    headers: { "content-type": "application/json" },
                });
            if (url.includes("/tournaments?")) {
                return json([
                    event("new-mc", { date: new Date(Date.now() - 3_600_000).toISOString() }),
                    event("new-md", {
                        format: "M-D",
                        date: new Date(Date.now() - 7_200_000).toISOString(),
                    }),
                    event("custom", { format: "CUSTOM" }),
                    event("tiny", { players: 12 }),
                ]);
            }
            if (options.rateLimitOn && url.includes(`/${options.rateLimitOn}/`)) {
                return json({ error: "slow down" }, 429);
            }
            if (url.endsWith("/details")) return json({ decklists: true });
            if (url.endsWith("/standings")) {
                return json(standings([TEAM_A, TEAM_B, TEAM_A, TEAM_B]));
            }
            return json({}, 404);
        }) as typeof fetch;
        return requested;
    }

    function makeEnv(db: ReturnType<typeof makeDb>) {
        return {
            META_DB: db,
            POKEMON_STATS: {
                async get(key: string) {
                    return key === "gen9championsvgc2026regmc:_index"
                        ? {
                              pokemon: {
                                  Charizard: 0.02,
                                  "Charizard-Mega-Y": 0.22,
                                  Rillaboom: 0.35,
                                  "Arcanine-Hisui": 0.06,
                              },
                          }
                        : null;
                },
            },
        } as unknown as Parameters<typeof refreshTournamentNewsroom>[0];
    }

    it("stores new events from every Champions regulation, with ladder comparison", async () => {
        const requested = stubLimitless();
        const db = makeDb();
        const result = await refreshTournamentNewsroom(makeEnv(db));

        assert.equal(result.fetchedCount, 2);
        // One unfiltered listing request — not one per registered regulation.
        assert.equal(requested.filter((path) => path.startsWith("/tournaments?")).length, 1);
        assert.ok(requested[0].includes("game=VGC") && !requested[0].includes("format="));

        const events = db.statements.filter((s) => s.sql.includes("INSERT INTO tournament_event"));
        assert.deepEqual(
            events.map((s) => [s.args[0], s.args[6]]),
            [
                ["new-mc", "champions-regmc"],
                ["new-md", "champions-regmd"],
            ],
        );
        const teams = db.statements.filter((s) => s.sql.includes("INSERT INTO tournament_team"));
        assert.equal(teams.length, 8);

        const stored = JSON.parse(events[0].args[8] as string);
        assert.equal(stored.regulationLabel, "Pokémon Champions — Regulation M-C");
        const charizard = stored.usageComparison.find(
            (row: { name: string }) => row.name === "Charizard",
        );
        assert.equal(charizard.pct, 100);
        assert.equal(charizard.ladderUsage.toFixed(2), "0.24");
        const arcanine = stored.usageComparison.find(
            (row: { name: string }) => row.name === "Hisuian Arcanine",
        );
        assert.equal(arcanine.ladderUsage, 0.06);
        const kingambit = stored.usageComparison.find(
            (row: { name: string }) => row.name === "Kingambit",
        );
        assert.equal(kingambit.ladderUsage, null);

        // A regulation with no usage statistics yet still gets its events, without a comparison.
        const unregistered = JSON.parse(events[1].args[8] as string);
        assert.equal(unregistered.regulationLabel, "Pokémon Champions — Regulation M-D");
        assert.ok(
            unregistered.usageComparison.every(
                (row: { ladderUsage: null }) => row.ladderUsage === null,
            ),
        );

        const job = lastStatement(db);
        assert.match(job?.sql ?? "", /status = 'success'/);
        assert.equal(job?.args[1], 2);
    });

    it("skips events that are already stored", async () => {
        stubLimitless();
        const db = makeDb(["new-mc", "new-md"]);
        const result = await refreshTournamentNewsroom(makeEnv(db));
        assert.equal(result.fetchedCount, 0);
        assert.equal(db.statements.filter((s) => s.sql.includes("tournament_event")).length, 0);
    });

    it("stops early when rate limited and still records a successful run", async () => {
        stubLimitless({ rateLimitOn: "new-md" });
        const db = makeDb();
        const result = await refreshTournamentNewsroom(makeEnv(db));
        assert.equal(result.fetchedCount, 1);
        assert.match(lastStatement(db)?.sql ?? "", /status = 'success'/);
    });

    it("marks the job failed when the event list cannot be read", async () => {
        globalThis.fetch = (async () => new Response("nope", { status: 503 })) as typeof fetch;
        const db = makeDb();
        await assert.rejects(refreshTournamentNewsroom(makeEnv(db)), /503/);
        assert.match(lastStatement(db)?.sql ?? "", /status = 'failed'/);
    });
});
