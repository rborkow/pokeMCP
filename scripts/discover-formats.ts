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
import { Statistics } from "smogon";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

const OUTPUT_PATH = join(process.cwd(), "src", "discovered-formats.json");

// Patterns for VGC and doubles formats
const VGC_PATTERN = /^gen\d+vgc/;
const DOUBLES_PATTERN = /^gen\d+doubles/;

// Hardcoded fallback in case Smogon is unreachable
const FALLBACK_VGC = [
    "gen9vgc2026regf",
    "gen9vgc2026regfbo3",
    "gen9vgc2025regi",
    "gen9vgc2024regh",
];
const FALLBACK_DOUBLES = ["gen9doublesou"];

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

        // Step 4: Filter for VGC and doubles
        const vgcFormats = allFormats.filter((f) => VGC_PATTERN.test(f)).sort();
        const doublesFormats = allFormats.filter((f) => DOUBLES_PATTERN.test(f)).sort();

        console.log(`VGC formats (${vgcFormats.length}):`);
        for (const f of vgcFormats) {
            console.log(`  - ${f}`);
        }

        console.log(`\nDoubles formats (${doublesFormats.length}):`);
        for (const f of doublesFormats) {
            console.log(`  - ${f}`);
        }

        // Step 5: Compare with previous discovery
        try {
            const previous = JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
            const prevAll = new Set([
                ...(previous.vgcFormats || []),
                ...(previous.doublesFormats || []),
            ]);
            const newFormats = [...vgcFormats, ...doublesFormats].filter((f) => !prevAll.has(f));
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
            discoveredAt: new Date().toISOString(),
            sourceMonth: "fallback",
        };

        writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 4));
        console.log(`Wrote fallback to ${OUTPUT_PATH}`);
    }
}

discoverFormats().catch(console.error);
