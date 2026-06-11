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
import { listRegulationStatsFormats } from "../src/regulations/registry.js";
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

// Regulation-mapped formats (e.g. Champions' gen9championsvgc2026regma) use a
// Smogon prefix the VGC/doubles discovery patterns never match, so pull them
// from the regulation registry — same source of truth as fetch-stats.ts.
function getDefaultFormats(): string[] {
    return [...new Set([...getVGCFormats(), ...listRegulationStatsFormats()])];
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
    : getDefaultFormats();

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

/**
 * Latest published stats month from Smogon's live directory listing.
 *
 * `Statistics.latestDate()` reads a latest.json table bundled into the smogon
 * package at publish time — it lags months behind the live data and is missing
 * brand-new formats entirely (e.g. the `gen9champions…` Champions formats).
 * Mirrors the same workaround in fetch-stats.ts; the bundled table stays as a
 * per-format fallback below.
 */
async function getLiveLatestMonth(): Promise<string | null> {
    try {
        const response = await fetch(Statistics.URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return Statistics.latest(await response.text()) || null;
    } catch (error) {
        console.warn("Could not resolve live latest month, using bundled latestDate:", error);
        return null;
    }
}

/**
 * Candidate lookback-window anchors for a format: the live latest month first,
 * then the bundled per-format latest — which covers rotated-out formats whose
 * last published data predates the live month by more than the window.
 */
async function getAnchors(format: string, liveLatest: string | null): Promise<string[]> {
    const anchors: string[] = [];
    if (liveLatest) anchors.push(liveLatest);
    try {
        const bundled = await Statistics.latestDate(format);
        if (bundled?.date && !anchors.includes(bundled.date)) anchors.push(bundled.date);
    } catch {
        // Bundled-table lookup is best-effort only.
    }
    return anchors;
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

    let totalLoaded = 0;
    let totalFailed = 0;
    const liveLatest = await getLiveLatestMonth();
    if (liveLatest) console.log(`Live latest stats month: ${liveLatest}\n`);

    for (const format of FORMATS) {
        const anchors = await getAnchors(format, liveLatest);
        if (anchors.length === 0) {
            console.warn(`No stats found for ${format}, skipping`);
            continue;
        }
        let loaded = 0;
        let failed = 0;

        for (const anchor of anchors) {
            for (const date of monthsBack(anchor, MONTHS)) {
                let file: string;
                let monCount: number;
                try {
                    const chaos = await fetchChaos(format, date);
                    if (!chaos?.data || Object.keys(chaos.data).length === 0) {
                        await delay(2000);
                        continue;
                    }
                    const result = chaosToRows(format, date, chaos);
                    // Load per-month so large continuous formats (e.g. gen9doublesou)
                    // don't produce a multi-MB file that strains `wrangler d1 execute`.
                    file = join(OUT_DIR, `${format}-${date}.sql`);
                    writeFileSync(file, buildSnapshotSql(result));
                    monCount = result.rows.length;
                } catch (e) {
                    console.warn(`  ✗ fetch ${format} ${date}: ${(e as Error).message}`);
                    await delay(2000);
                    continue;
                }

                if (DRY_RUN) {
                    console.log(`  ✓ ${format} ${date} (${monCount} mons, SQL written)`);
                    loaded++;
                } else {
                    try {
                        loadIntoD1(file);
                        console.log(`  ✓ ${format} ${date} (${monCount} mons, loaded)`);
                        loaded++;
                    } catch (e) {
                        // A load failure is real (e.g. the token lacks D1 edit permission);
                        // count it so the run fails loudly rather than reporting false success.
                        console.error(`  ✗ load ${format} ${date}: ${(e as Error).message}`);
                        failed++;
                    }
                }
                await delay(2000); // be polite to Smogon
            }
            // Anything captured (or a real load failure) means this anchor's
            // window was right — don't refetch an older, overlapping window.
            if (loaded + failed > 0) break;
        }

        totalLoaded += loaded;
        totalFailed += failed;
        if (loaded === 0 && failed === 0) {
            console.log(`  (no data captured for ${format})`);
        } else {
            console.log(
                `  → ${format}: ${loaded} ${DRY_RUN ? "written" : "loaded"}, ${failed} failed`,
            );
        }
    }

    console.log(
        `\nDone. ${totalLoaded} snapshot(s) ${DRY_RUN ? "written" : "loaded"}, ${totalFailed} failed.` +
            (DRY_RUN ? ` SQL in ${OUT_DIR}.` : ""),
    );
    if (totalFailed > 0) {
        console.error(
            `\n✗ ${totalFailed} snapshot load(s) failed — the CLOUDFLARE_API_TOKEN may lack D1 ` +
                "edit permission, or D1 was unreachable. Fix and re-run.",
        );
        process.exitCode = 1;
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
