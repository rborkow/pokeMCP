/**
 * Upload cached Champions legality blobs to the POKEMON_STATS KV namespace.
 *
 * Reads everything under src/cached-champions-legality/<regulation-id>.json
 * and puts each one at the KV key defined on the regulation. Intentionally
 * refuses to upload an empty or malformed blob — see fetch-champions-legality
 * for the matching producer-side check.
 *
 * Usage:
 *   npm run upload-champions-legality
 *   KV_NAMESPACE_ID=xxx npm run upload-champions-legality
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { REGULATIONS } from "../src/regulations/registry.js";
import type { LegalityKvBlob } from "../src/regulations/types.js";

const KV_NAMESPACE_ID = process.env.KV_NAMESPACE_ID || "58525ad4ec5c454eb3e1ae7586414483";
const CACHE_DIR = "src/cached-champions-legality";

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
        { stdio: "inherit", timeout: 120_000 },
    );
}

function isValidBlob(v: unknown): v is LegalityKvBlob {
    if (!v || typeof v !== "object") return false;
    const b = v as Record<string, unknown>;
    return (
        typeof b.regulationId === "string" &&
        typeof b.fetchedAt === "string" &&
        typeof b.sourceUrl === "string" &&
        typeof b.version === "number" &&
        Array.isArray(b.pokemon) &&
        b.pokemon.length >= 50 &&
        b.pokemon.every((p) => typeof p === "string")
    );
}

function main() {
    if (!existsSync(CACHE_DIR)) {
        throw new Error(
            `${CACHE_DIR} does not exist. Run scripts/fetch-champions-legality.ts first.`,
        );
    }

    const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
    if (files.length === 0) {
        throw new Error(`No legality files found in ${CACHE_DIR}.`);
    }

    console.log(`Uploading Champions legality data (namespace: ${KV_NAMESPACE_ID})`);

    for (const file of files) {
        const regulationId = basename(file, ".json");
        const regulation = REGULATIONS.find((r) => r.id === regulationId);
        if (!regulation) {
            console.warn(`Skipping ${file}: no matching regulation in registry`);
            continue;
        }

        const filePath = join(CACHE_DIR, file);
        const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
        if (!isValidBlob(parsed)) {
            throw new Error(
                `Refusing to upload ${file}: file does not match LegalityKvBlob shape ` +
                    "or has fewer than 50 Pokémon. Re-run fetch-champions-legality.",
            );
        }

        console.log(
            `  ${regulation.id}: ${parsed.pokemon.length} Pokémon → ${regulation.legalityKvKey}`,
        );
        kvPutPath(regulation.legalityKvKey, filePath);
    }

    console.log("Upload complete.");
}

main();
