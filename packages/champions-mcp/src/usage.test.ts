import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import { latestUsage, loadUsageFromDir, topSpreads } from "./usage.js";

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
});
