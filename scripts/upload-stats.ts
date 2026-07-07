/**
 * Upload cached stats to Cloudflare KV with per-Pokemon key splitting.
 *
 * For each format, uploads:
 *   {format}:_index  — lightweight index with info + pokemon usage map
 *   {format}:{id}    — individual Pokemon stats keyed by toID(name)
 *
 * Uses `wrangler kv bulk put` to batch all keys per format into a single API call,
 * dramatically reducing upload time vs individual key puts.
 *
 * Usage:
 *   npm run upload-stats                         # Uses production KV
 *   KV_NAMESPACE_ID=xxx npm run upload-stats     # Custom namespace
 */

import { execFileSync } from "node:child_process";
import {
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { shouldFailRun } from "./lib/stats-run-policy.js";

function toID(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const KV_NAMESPACE_ID = process.env.KV_NAMESPACE_ID || "58525ad4ec5c454eb3e1ae7586414483";
const CACHE_DIR = "src/cached-stats";
const MIN_FILE_SIZE = 300;
// wrangler bulk put limit: 10,000 keys or 100MB per call. We batch conservatively.
const BULK_BATCH_SIZE = 500;

type BulkEntry = { key: string; value: string };

function kvBulkPut(entries: BulkEntry[]): void {
    if (entries.length === 0) return;

    const tmpFile = `/tmp/kv-bulk-${Date.now()}.json`;
    writeFileSync(tmpFile, JSON.stringify(entries));
    try {
        execFileSync(
            "npx",
            [
                "wrangler",
                "kv",
                "bulk",
                "put",
                "--remote",
                `--namespace-id=${KV_NAMESPACE_ID}`,
                tmpFile,
            ],
            { stdio: "pipe", timeout: 120_000 },
        );
    } finally {
        unlinkSync(tmpFile);
    }
}

function kvPutPath(key: string, filePath: string): void {
    execFileSync(
        "npx",
        [
            "wrangler",
            "kv",
            "key",
            "put",
            "--remote",
            `--namespace-id=${KV_NAMESPACE_ID}`,
            key,
            `--path=${filePath}`,
        ],
        { stdio: "pipe", timeout: 120_000 },
    );
}

function uploadFormat(file: string): "uploaded" | "skipped" {
    const format = basename(file, ".json");
    const filePath = join(CACHE_DIR, file);
    const size = statSync(filePath).size;

    if (size < MIN_FILE_SIZE) {
        console.log(`Skipping ${format} (no data - ${size} bytes)`);
        return "skipped";
    }

    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));

    const info = parsed.data?.info;
    const pokemonData = parsed.data?.data;

    if (!info || !pokemonData) {
        console.log(`Skipping ${format} (invalid structure)`);
        return "skipped";
    }

    const pokemonNames = Object.keys(pokemonData);
    console.log(
        `\nProcessing ${format} (${pokemonNames.length} Pokemon, ${(size / 1024).toFixed(0)}KB)...`,
    );

    // 1. Per-Pokemon keys — uploaded FIRST
    const pokemonEntries: BulkEntry[] = [];
    for (const name of pokemonNames) {
        const id = toID(name);
        const value = { displayName: name, ...pokemonData[name] };
        pokemonEntries.push({ key: `${format}:${id}`, value: JSON.stringify(value) });
    }

    // 2. Index key — uploaded LAST, only after every Pokemon key is live.
    // If the index went up first and a later batch failed, production would
    // serve a live index referencing per-Pokemon keys that 404.
    const pokemonUsageMap: Record<string, number> = {};
    for (const name of pokemonNames) {
        pokemonUsageMap[name] = pokemonData[name].usage ?? 0;
    }
    const index = { info, pokemon: pokemonUsageMap, version: 2 };
    const indexEntry: BulkEntry = { key: `${format}:_index`, value: JSON.stringify(index) };

    // Upload Pokemon batches first
    const totalBatches = Math.ceil(pokemonEntries.length / BULK_BATCH_SIZE);
    for (let i = 0; i < pokemonEntries.length; i += BULK_BATCH_SIZE) {
        const batch = pokemonEntries.slice(i, i + BULK_BATCH_SIZE);
        const batchNum = Math.floor(i / BULK_BATCH_SIZE) + 1;
        console.log(`  Uploading batch ${batchNum}/${totalBatches} (${batch.length} keys)...`);
        kvBulkPut(batch);
    }

    // Then the index, in its own final put
    console.log("  Uploading index (last)...");
    kvBulkPut([indexEntry]);

    console.log(`  Done: ${pokemonEntries.length + 1} keys uploaded for ${format}`);
    return "uploaded";
}

function main() {
    console.log(`Uploading stats to POKEMON_STATS KV (namespace: ${KV_NAMESPACE_ID})...\n`);

    const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));

    let uploaded = 0;
    let skipped = 0;
    const failedFormats: string[] = [];
    for (const file of files) {
        try {
            if (uploadFormat(file) === "uploaded") {
                uploaded++;
            } else {
                skipped++;
            }
        } catch (error) {
            const format = basename(file, ".json");
            console.error(`✗ Upload failed for ${format}:`, error);
            failedFormats.push(format);
        }
    }

    // Upload discovered formats
    const discoveryFile = "src/discovered-formats.json";
    if (existsSync(discoveryFile)) {
        console.log("\nUploading discovered formats...");
        try {
            kvPutPath("_discovered_formats", discoveryFile);
        } catch (error) {
            // A failed discovery-manifest put means the KV token/API is broken
            // — never report a green run on top of that.
            console.error("✗ Failed to upload discovered formats:", error);
            process.exitCode = 1;
        }
    }

    // Summary + failure policy: a failed run must LOOK failed. Zero formats
    // uploaded or a majority failed exits non-zero; a minority of failures is
    // logged loudly but does not fail the run.
    console.log(
        `\nUpload summary: ${uploaded} uploaded, ${skipped} skipped (no data), ` +
            `${failedFormats.length} failed`,
    );
    if (failedFormats.length > 0) {
        console.error(`✗ Failed formats: ${failedFormats.join(", ")}`);
    }

    if (shouldFailRun(uploaded, failedFormats.length)) {
        console.error(
            "\n✗ Upload failed: zero formats uploaded or a majority failed. " +
                "Check the Cloudflare API token / KV availability.",
        );
        process.exitCode = 1;
    } else if (failedFormats.length > 0) {
        console.warn(
            "\n⚠ Upload finished, but some formats failed (see above). " +
                "Their KV data is still last month's — re-run for those formats.",
        );
    } else {
        console.log("\nUpload complete!");
    }
    console.log("Verify with: curl https://api.pokemcp.com/test-kv");
}

main();
