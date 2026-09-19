import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

/**
 * Local cache of Smogon monthly chaos usage dumps for Champions formats.
 * Files live in data/usage/ and are written by scripts/fetch-usage.ts;
 * each file is a normalized `{format}-{YYYY-MM}.json` (or `.json.gz`, the
 * trimmed + gzipped form) UsageBlob. Both are read by `loadUsageFromDir`.
 */
export interface UsageEntry {
    usage: number;
    Abilities: Record<string, number>;
    Items: Record<string, number>;
    Spreads: Record<string, number>;
    Moves: Record<string, number>;
    Teammates: Record<string, number>;
    "Checks and Counters": Record<string, { n: number; p: number; d: number }>;
}

/** Trim policy applied by scripts/fetch-usage.ts before writing the cache. */
export interface UsageTrimPolicy {
    minUsage: number;
    topN: {
        Abilities: number;
        Items: number;
        Moves: number;
        Spreads: number;
        Teammates: number;
        "Checks and Counters": number;
    };
}

export interface UsageBlob {
    format: string;
    month: string;
    cutoff: number;
    battles: number;
    pokemon: Record<string, UsageEntry>;
    /** Absent on untrimmed blobs (e.g. hand-written test fixtures). */
    trimmed?: UsageTrimPolicy;
}

const here = dirname(fileURLToPath(import.meta.url));
export const USAGE_DIR = join(here, "..", "data", "usage");

export function loadUsageFromDir(dir = USAGE_DIR): UsageBlob[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((f) => f.endsWith(".json") || f.endsWith(".json.gz"))
        .map((f) => {
            const buf = readFileSync(join(dir, f));
            const text = f.endsWith(".gz")
                ? gunzipSync(buf).toString("utf-8")
                : buf.toString("utf-8");
            return JSON.parse(text) as UsageBlob;
        });
}

export function latestUsage(blobs: UsageBlob[], format: string): UsageBlob | undefined {
    return blobs
        .filter((b) => b.format === format)
        .sort((a, b) => b.month.localeCompare(a.month))[0];
}

function pct(map: Record<string, number>, limit: number): { key: string; pct: number }[] {
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([key, v]) => ({ key, pct: Math.round((v / total) * 1000) / 10 }));
}

/** Top spreads as Stat Point strings ('Nature:HP/Atk/Def/SpA/SpD/Spe'), Champions has no EVs. */
export function topSpreads(
    blob: UsageBlob,
    pokemon: string,
    limit = 5,
): { spread: string; pct: number }[] {
    const e = blob.pokemon[pokemon];
    if (!e) return [];
    return pct(e.Spreads, limit).map(({ key, pct: p }) => ({ spread: key, pct: p }));
}

export function topOf(
    blob: UsageBlob,
    pokemon: string,
    field: "Items" | "Moves" | "Abilities" | "Teammates",
    limit = 5,
): { key: string; pct: number }[] {
    const e = blob.pokemon[pokemon];
    return e ? pct(e[field], limit) : [];
}

export function usageRanking(blob: UsageBlob, limit = 30): { pokemon: string; usage: number }[] {
    return Object.entries(blob.pokemon)
        .map(([pokemon, e]) => ({ pokemon, usage: Math.round(e.usage * 1000) / 10 }))
        .sort((a, b) => b.usage - a.usage)
        .slice(0, limit);
}
