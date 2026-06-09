/**
 * Backfill historical Smogon usage stats into the META_DB D1 time-series.
 *
 * Pulls N months of "chaos" stats from Smogon's public monthly archives for
 * VGC/doubles formats and loads them into D1. Reuses the same chaos -> rows
 * mapping as the monthly append path (scripts/lib/chaos-to-rows.ts), so
 * backfilled and ongoing snapshots are identical in shape.
 *
 * Idempotent: re-running a month overwrites via the composite primary key.
 *
 * Usage:
 *   bun run backfill-history                       # last 18 months, VGC/doubles, remote D1
 *   MONTHS=24 bun run backfill-history             # custom lookback
 *   FORMATS=gen9vgc2026regf,gen9doublesou bun run backfill-history
 *   D1_LOCAL=1 bun run backfill-history            # load into local D1 (wrangler --local)
 *   DRY_RUN=1 bun run backfill-history             # only emit SQL files, don't execute
 *   WRANGLER_ENV=production bun run backfill-history
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Statistics } from "smogon";
import { type ChaosSnapshot, chaosToRows } from "./lib/chaos-to-rows.js";
import { buildSnapshotSql } from "./lib/d1-sql.js";

// Hardcoded fallback for VGC/doubles if discovery hasn't run (mirrors fetch-stats.ts).
const FALLBACK_VGC_FORMATS = [
    "gen9vgc2026regf",
    "gen9vgc2026regfbo3",
    "gen9vgc2025regi",
    "gen9vgc2024regh",
    "gen9doublesou",
];

function getVGCFormats(): string[] {
    try {
        const discoveryPath = join(process.cwd(), "src", "discovered-formats.json");
        const discovered = JSON.parse(readFileSync(discoveryPath, "utf-8"));
        const formats = [...(discovered.vgcFormats || []), ...(discovered.doublesFormats || [])];
        if (formats.length > 0) return formats;
    } catch {
        // Discovery file doesn't exist yet — fall back.
    }
    return FALLBACK_VGC_FORMATS;
}

const MONTHS = Number(process.env.MONTHS || 18);
const DB = process.env.D1_DATABASE || "META_DB";
const OUT_DIR = process.env.OUT_DIR || "/tmp/d1-backfill";
const DRY_RUN = process.env.DRY_RUN === "1";
const LOCAL = process.env.D1_LOCAL === "1";
const WRANGLER_ENV = process.env.WRANGLER_ENV;
const FORMATS = process.env.FORMATS
    ? process.env.FORMATS.split(",")
          .map((s) => s.trim())
          .filter(Boolean)
    : getVGCFormats();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function monthIndex(date: string): number {
    const [y, m] = date.split("-").map(Number);
    return y * 12 + (m - 1);
}
function indexToMonth(i: number): string {
    const y = Math.floor(i / 12);
    const m = (i % 12) + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
}
function monthsBack(latest: string, n: number): string[] {
    const end = monthIndex(latest);
    const out: string[] = [];
    for (let i = n - 1; i >= 0; i--) out.push(indexToMonth(end - i));
    return out;
}

async function fetchChaos(format: string, date: string): Promise<ChaosSnapshot | null> {
    const url = Statistics.url(date, format, true, "chaos");
    const response = await fetch(url);
    if (!response.ok) return null; // 404 = format didn't exist that month
    const raw = await response.text();
    return Statistics.process(raw) as unknown as ChaosSnapshot;
}

function loadIntoD1(file: string): void {
    const args = ["wrangler", "d1", "execute", DB, LOCAL ? "--local" : "--remote", "--file", file];
    if (WRANGLER_ENV) args.push("--env", WRANGLER_ENV);
    execFileSync("npx", args, { stdio: "inherit", timeout: 300_000 });
}

async function main() {
    mkdirSync(OUT_DIR, { recursive: true });
    console.log(
        `Backfilling ${FORMATS.length} format(s) × up to ${MONTHS} months → D1 ` +
            `(${LOCAL ? "local" : "remote"}${DRY_RUN ? ", DRY RUN" : ""})\n`,
    );

    for (const format of FORMATS) {
        const latest = await Statistics.latestDate(format);
        if (!latest) {
            console.warn(`No stats found for ${format}, skipping`);
            continue;
        }
        const months = monthsBack(latest.date, MONTHS);
        let captured = 0;

        for (const date of months) {
            try {
                const chaos = await fetchChaos(format, date);
                if (!chaos?.data || Object.keys(chaos.data).length === 0) {
                    await delay(2000);
                    continue;
                }
                const result = chaosToRows(format, date, chaos);
                // Load per-month so large continuous formats (e.g. gen9doublesou)
                // don't produce a multi-MB file that strains `wrangler d1 execute`.
                const file = join(OUT_DIR, `${format}-${date}.sql`);
                writeFileSync(file, buildSnapshotSql(result));
                captured++;
                console.log(`  ✓ ${format} ${date} (${result.rows.length} mons)`);
                if (!DRY_RUN) loadIntoD1(file);
            } catch (e) {
                console.warn(`  ✗ ${format} ${date}: ${(e as Error).message}`);
            }
            await delay(2000); // be polite to Smogon
        }

        if (captured === 0) {
            console.log(`  (no data captured for ${format})`);
            continue;
        }
        console.log(`  → ${format}: ${captured} snapshot(s) ${DRY_RUN ? "written" : "loaded"}`);
    }

    console.log(
        `\nDone.${
            DRY_RUN
                ? ` SQL in ${OUT_DIR}; load with: wrangler d1 execute ${DB} --remote --file=<file>`
                : ""
        }`,
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
