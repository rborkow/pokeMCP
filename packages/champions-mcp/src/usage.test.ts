import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import { latestUsage, loadUsageFromDir, topOf, topSpreads } from "./usage.js";

describe("usage cache", () => {
    it("loads the newest month for a format and exposes normalized spreads", () => {
        const dir = mkdtempSync(join(tmpdir(), "usage-"));
        const blob = {
            format: "gen9championsvgc2026regmc",
            month: "2026-09",
            cutoff: 1630,
            battles: 100,
            pokemon: {
                Kingambit: {
                    usage: 0.4,
                    Items: { blackglasses: 60, chopleberry: 40 },
                    Spreads: { "Adamant:32/32/0/0/2/0": 70, "Adamant:0/32/0/0/2/32": 30 },
                    Moves: {},
                    Abilities: {},
                    Teammates: {},
                    "Checks and Counters": {},
                },
            },
        };
        writeFileSync(
            join(dir, "gen9championsvgc2026regmc-2026-08.json"),
            JSON.stringify({ ...blob, month: "2026-08" }),
        );
        writeFileSync(join(dir, "gen9championsvgc2026regmc-2026-09.json"), JSON.stringify(blob));
        const all = loadUsageFromDir(dir);
        const latest = latestUsage(all, "gen9championsvgc2026regmc");
        assert.equal(latest?.month, "2026-09");
        assert.deepEqual(topSpreads(latest!, "Kingambit", 1), [
            { spread: "Adamant:32/32/0/0/2/0", pct: 70 },
        ]);
    });

    it("reads gzipped cache files written by fetch-usage", () => {
        const dir = mkdtempSync(join(tmpdir(), "usage-gz-"));
        const blob = {
            format: "gen9championsvgc2026regmc",
            month: "2026-09",
            cutoff: 1630,
            battles: 100,
            pokemon: {
                Kingambit: {
                    usage: 0.4,
                    Items: { blackglasses: 60, chopleberry: 40 },
                    Spreads: { "Adamant:32/32/0/0/2/0": 70, "Adamant:0/32/0/0/2/32": 30 },
                    Moves: {},
                    Abilities: {},
                    Teammates: {},
                    "Checks and Counters": {},
                },
            },
        };
        writeFileSync(
            join(dir, "gen9championsvgc2026regmc-2026-09.json.gz"),
            gzipSync(JSON.stringify(blob)),
        );
        const all = loadUsageFromDir(dir);
        const latest = latestUsage(all, "gen9championsvgc2026regmc");
        assert.equal(latest?.month, "2026-09");
        assert.deepEqual(topSpreads(latest!, "Kingambit", 1), [
            { spread: "Adamant:32/32/0/0/2/0", pct: 70 },
        ]);
    });

    it("skips unreadable cache files instead of failing the whole load", () => {
        const dir = mkdtempSync(join(tmpdir(), "usage-corrupt-"));
        const blob = {
            format: "gen9championsvgc2026regmc",
            month: "2026-09",
            cutoff: 1630,
            battles: 100,
            pokemon: {},
        };
        writeFileSync(join(dir, "gen9championsvgc2026regmc-2026-09.json"), JSON.stringify(blob));
        writeFileSync(join(dir, "gen9championsvgc2026regmb-2026-08.json.gz"), "not gzip data");
        const originalError = console.error;
        const warnings: string[] = [];
        console.error = (...args: unknown[]) => {
            warnings.push(args.map(String).join(" "));
        };
        try {
            assert.equal(loadUsageFromDir(dir).length, 1);
        } finally {
            console.error = originalError;
        }
        assert.equal(warnings.length, 1);
        assert.match(
            warnings[0],
            /usage cache: skipping unreadable gen9championsvgc2026regmb-2026-08\.json\.gz/,
        );
    });

    it("computes shares against the pre-trim total when the cache stores one", () => {
        // Trimmed cache: retained Items sum to 60, but the full pre-trim map summed to 100.
        const trimmed = {
            format: "gen9championsvgc2026regmc",
            month: "2026-09",
            cutoff: 1630,
            battles: 100,
            pokemon: {
                Kingambit: {
                    usage: 0.4,
                    Items: { blackglasses: 40, chopleberry: 20 },
                    Spreads: { "Adamant:32/32/0/0/2/0": 10, "Adamant:0/32/0/0/2/32": 10 },
                    Moves: {},
                    Abilities: {},
                    Teammates: {},
                    "Checks and Counters": {},
                    _totals: { Items: 100, Spreads: 200 },
                },
            },
        };
        assert.deepEqual(topOf(trimmed as never, "Kingambit", "Items", 1), [
            { key: "blackglasses", pct: 40 },
        ]);
        assert.deepEqual(topSpreads(trimmed as never, "Kingambit", 1), [
            { spread: "Adamant:32/32/0/0/2/0", pct: 5 },
        ]);
        // No _totals (untrimmed fixture): denominator stays the retained sum.
        const untrimmed = structuredClone(trimmed);
        delete (untrimmed.pokemon.Kingambit as Record<string, unknown>)._totals;
        assert.deepEqual(topOf(untrimmed as never, "Kingambit", "Items", 1), [
            { key: "blackglasses", pct: 66.7 },
        ]);
    });
});
