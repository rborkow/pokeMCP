/**
 * Auto-discover available VGC and doubles formats from Smogon stats.
 *
 * Fetches the Smogon stats directory to find all published formats,
 * then filters for VGC and doubles formats. Writes results to
 * src/discovered-formats.json for use by fetch-stats.ts and the
 * ingestion orchestrator.
 *
 * Usage: npm run discover-formats
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { Statistics } from "smogon";

const OUTPUT_PATH = join(process.cwd(), "src", "discovered-formats.json");

// Patterns for VGC and doubles formats
const VGC_PATTERN = /^gen\d+vgc/;
const DOUBLES_PATTERN = /^gen\d+doubles/;
// Pokémon Champions formats (e.g. gen9championsvgc2026regma, gen9championsbssregma).
// Tracked for visibility so new regulations surface in the monthly run; which of
// these we actually ingest is decided by the regulation registry's showdownFormatId.
const CHAMPIONS_PATTERN = /^gen\d+champions/;

// Hardcoded fallback in case Smogon is unreachable
const FALLBACK_VGC = [
    "gen9vgc2026regf",
    "gen9vgc2026regfbo3",
    "gen9vgc2025regi",
    "gen9vgc2024regh",
];
const FALLBACK_DOUBLES = ["gen9doublesou"];
const FALLBACK_CHAMPIONS = ["gen9championsvgc2026regma"];

async function discoverFormats() {
    console.log("Discovering available formats from Smogon stats...\n");

    try {
        // Step 1: Fetch the stats index to find the latest month
        console.log(`Fetching ${Statistics.URL}...`);
        const indexResponse = await fetch(Statistics.URL);
        if (!indexResponse.ok) {
            throw new Error(`Failed to fetch stats index: ${indexResponse.status}`);
        }
        const indexHtml = await indexResponse.text();
        const latestDate = Statistics.latest(indexHtml);
        console.log(`Latest stats month: ${latestDate}\n`);

        // Step 2: Fetch the directory listing for that month
        const monthUrl = `${Statistics.URL}${latestDate}/`;
        console.log(`Fetching ${monthUrl}...`);
        const monthResponse = await fetch(monthUrl);
        if (!monthResponse.ok) {
            throw new Error(`Failed to fetch month listing: ${monthResponse.status}`);
        }
        const monthHtml = await monthResponse.text();

        // Step 3: Extract all format names
        const allFormats = Statistics.formats(monthHtml);
        console.log(`Found ${allFormats.length} total formats\n`);

        // Step 4: Filter for VGC, doubles, and Champions
        const vgcFormats = allFormats.filter((f) => VGC_PATTERN.test(f)).sort();
        const doublesFormats = allFormats.filter((f) => DOUBLES_PATTERN.test(f)).sort();
        const championsFormats = allFormats.filter((f) => CHAMPIONS_PATTERN.test(f)).sort();

        console.log(`VGC formats (${vgcFormats.length}):`);
        for (const f of vgcFormats) {
            console.log(`  - ${f}`);
        }

        console.log(`\nDoubles formats (${doublesFormats.length}):`);
        for (const f of doublesFormats) {
            console.log(`  - ${f}`);
        }

        console.log(`\nChampions formats (${championsFormats.length}):`);
        for (const f of championsFormats) {
            console.log(`  - ${f}`);
        }

        // Step 5: Compare with previous discovery
        try {
            const previous = JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
            const prevAll = new Set([
                ...(previous.vgcFormats || []),
                ...(previous.doublesFormats || []),
                ...(previous.championsFormats || []),
            ]);
            const newFormats = [...vgcFormats, ...doublesFormats, ...championsFormats].filter(
                (f) => !prevAll.has(f),
            );
            if (newFormats.length > 0) {
                console.log(`\nNEW formats discovered: ${newFormats.join(", ")}`);
            } else {
                console.log("\nNo new formats since last discovery.");
            }
        } catch {
            console.log("\nFirst discovery run (no previous data).");
        }

        // Step 6: Write results
        const result = {
            vgcFormats,
            doublesFormats,
            championsFormats,
            discoveredAt: new Date().toISOString(),
            sourceMonth: latestDate,
        };

        writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 4));
        console.log(`\nWrote ${OUTPUT_PATH}`);
    } catch (error) {
        console.error("Discovery failed:", error);
        console.log("\nUsing hardcoded fallback formats.");

        const result = {
            vgcFormats: FALLBACK_VGC,
            doublesFormats: FALLBACK_DOUBLES,
            championsFormats: FALLBACK_CHAMPIONS,
            discoveredAt: new Date().toISOString(),
            sourceMonth: "fallback",
        };

        writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 4));
        console.log(`Wrote fallback to ${OUTPUT_PATH}`);
    }
}

discoverFormats().catch(console.error);
