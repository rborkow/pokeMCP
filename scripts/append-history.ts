/**
 * Append the latest fetched Smogon snapshots into the META_DB D1 time-series.
 *
 * Run after `bun run fetch-stats` (the cached JSON is already on disk). Reuses
 * the same chaos -> rows mapping and SQL emitter as the backfill. This is the
 * ongoing monthly capture step — KV ("latest") is still written by upload-stats;
 * this adds exactly one new (format, date) slice per format to D1.
 *
 * Idempotent: re-running the same month overwrites via the composite primary key.
 *
 * Usage:
 *   bun run append-history                 # all cached formats → remote D1
 *   D1_LOCAL=1 bun run append-history      # local D1
 *   DRY_RUN=1 bun run append-history       # emit SQL only
 *   WRANGLER_ENV=production bun run append-history
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { chaosToRows } from "./lib/chaos-to-rows.js";
import { buildSnapshotSql } from "./lib/d1-sql.js";

const CACHE_DIR = join(process.cwd(), "src", "cached-stats");
const DB = process.env.D1_DATABASE || "META_DB";
const OUT_DIR = process.env.OUT_DIR || "/tmp/d1-append";
const DRY_RUN = process.env.DRY_RUN === "1";
const LOCAL = process.env.D1_LOCAL === "1";
const WRANGLER_ENV = process.env.WRANGLER_ENV;
const MIN_FILE_SIZE = 300;

function loadIntoD1(file: string): void {
    const args = ["wrangler", "d1", "execute", DB, LOCAL ? "--local" : "--remote", "--file", file];
    if (WRANGLER_ENV) args.push("--env", WRANGLER_ENV);
    execFileSync("npx", args, { stdio: "inherit", timeout: 300_000 });
}

function main() {
    mkdirSync(OUT_DIR, { recursive: true });
    const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
    let count = 0;

    for (const f of files) {
        const path = join(CACHE_DIR, f);
        if (statSync(path).size < MIN_FILE_SIZE) continue;

        const parsed = JSON.parse(readFileSync(path, "utf-8"));
        const chaos = parsed.data;
        if (!chaos?.info || !chaos?.data) {
            console.log(`Skipping ${f} (invalid structure)`);
            continue;
        }
        const format = parsed.format || basename(f, ".json");
        const date = parsed.date;
        if (!date) {
            console.log(`Skipping ${format} (no date)`);
            continue;
        }

        const result = chaosToRows(format, date, chaos, { fetchedAt: parsed.fetchedAt });
        const file = join(OUT_DIR, `${format}.sql`);
        writeFileSync(file, buildSnapshotSql(result));
        console.log(`${format} ${date}: ${result.rows.length} mons → ${file}`);
        if (!DRY_RUN) loadIntoD1(file);
        count++;
    }

    console.log(`\nAppended ${count} snapshot(s)${DRY_RUN ? " (DRY RUN — SQL only)" : ""}.`);
}

main();
