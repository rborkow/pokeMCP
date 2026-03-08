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
    readFileSync,
    readdirSync,
    statSync,
    existsSync,
    writeFileSync,
    unlinkSync,
} from "node:fs";
import { join, basename } from "node:path";

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

function uploadFormat(file: string): void {
    const format = basename(file, ".json");
    const filePath = join(CACHE_DIR, file);
    const size = statSync(filePath).size;

    if (size < MIN_FILE_SIZE) {
        console.log(`Skipping ${format} (no data - ${size} bytes)`);
        return;
    }

    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));

    const info = parsed.data?.info;
    const pokemonData = parsed.data?.data;

    if (!info || !pokemonData) {
        console.log(`Skipping ${format} (invalid structure)`);
        return;
    }

    const pokemonNames = Object.keys(pokemonData);
    console.log(
        `\nProcessing ${format} (${pokemonNames.length} Pokemon, ${(size / 1024).toFixed(0)}KB)...`,
    );

    // Build all entries for bulk upload
    const entries: BulkEntry[] = [];

    // 1. Index key
    const pokemonUsageMap: Record<string, number> = {};
    for (const name of pokemonNames) {
        pokemonUsageMap[name] = pokemonData[name].usage ?? 0;
    }
    const index = { info, pokemon: pokemonUsageMap, version: 2 };
    entries.push({ key: `${format}:_index`, value: JSON.stringify(index) });

    // 2. Per-Pokemon keys
    for (const name of pokemonNames) {
        const id = toID(name);
        const value = { displayName: name, ...pokemonData[name] };
        entries.push({ key: `${format}:${id}`, value: JSON.stringify(value) });
    }

    // Upload in batches
    const totalBatches = Math.ceil(entries.length / BULK_BATCH_SIZE);
    for (let i = 0; i < entries.length; i += BULK_BATCH_SIZE) {
        const batch = entries.slice(i, i + BULK_BATCH_SIZE);
        const batchNum = Math.floor(i / BULK_BATCH_SIZE) + 1;
        console.log(`  Uploading batch ${batchNum}/${totalBatches} (${batch.length} keys)...`);
        kvBulkPut(batch);
    }

    console.log(`  Done: ${entries.length} keys uploaded for ${format}`);
}

function main() {
    console.log(`Uploading stats to POKEMON_STATS KV (namespace: ${KV_NAMESPACE_ID})...\n`);

    const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));

    for (const file of files) {
        uploadFormat(file);
    }

    // Upload discovered formats
    const discoveryFile = "src/discovered-formats.json";
    if (existsSync(discoveryFile)) {
        console.log("\nUploading discovered formats...");
        kvPutPath("_discovered_formats", discoveryFile);
    }

    console.log("\nUpload complete!");
    console.log("Verify with: curl https://api.pokemcp.com/test-kv");
}

main();
