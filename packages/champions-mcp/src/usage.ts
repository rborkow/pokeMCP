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
    /**
     * Sums of the FULL pre-trim maps written by scripts/fetch-usage.ts. The
     * stored maps are trimmed to top-N, so shares are only true percentages
     * when divided by these totals. Absent on untrimmed blobs/fixtures, in
     * which case the retained sum remains the denominator.
     */
    _totals?: Partial<Record<"Abilities" | "Items" | "Moves" | "Spreads" | "Teammates", number>>;
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
        .flatMap((f) => {
            try {
                const buf = readFileSync(join(dir, f));
                const text = f.endsWith(".gz")
                    ? gunzipSync(buf).toString("utf-8")
                    : buf.toString("utf-8");
                return [JSON.parse(text) as UsageBlob];
            } catch (error) {
                // One bad cache file must not disable get_usage / meta_snapshot.
                // stderr only: this is a stdio MCP server, stdout is the protocol.
                const msg = error instanceof Error ? error.message : String(error);
                console.error(`usage cache: skipping unreadable ${f}: ${msg}`);
                return [];
            }
        });
}

export function latestUsage(blobs: UsageBlob[], format: string): UsageBlob | undefined {
    return blobs
        .filter((b) => b.format === format)
        .sort((a, b) => b.month.localeCompare(a.month))[0];
}

function pct(
    map: Record<string, number>,
    limit: number,
    total?: number,
): { key: string; pct: number }[] {
    // Prefer the pre-trim total (see UsageEntry._totals); fall back to the
    // retained sum for untrimmed blobs so shares still add up to 100%. A
    // zero/absent total never divides: `||` picks the next non-zero operand.
    const denom = total || Object.values(map).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([key, v]) => ({ key, pct: Math.round((v / denom) * 1000) / 10 }));
}

/** Top spreads as Stat Point strings ('Nature:HP/Atk/Def/SpA/SpD/Spe'), Champions has no EVs. */
export function topSpreads(
    blob: UsageBlob,
    pokemon: string,
    limit = 5,
): { spread: string; pct: number }[] {
    const e = blob.pokemon[pokemon];
    if (!e) return [];
    return pct(e.Spreads, limit, e._totals?.Spreads).map(({ key, pct: p }) => ({
        spread: key,
        pct: p,
    }));
}

export function topOf(
    blob: UsageBlob,
    pokemon: string,
    field: "Items" | "Moves" | "Abilities" | "Teammates",
    limit = 5,
): { key: string; pct: number }[] {
    const e = blob.pokemon[pokemon];
    return e ? pct(e[field], limit, e._totals?.[field]) : [];
}

export function usageRanking(blob: UsageBlob, limit = 30): { pokemon: string; usage: number }[] {
    return Object.entries(blob.pokemon)
        .map(([pokemon, e]) => ({ pokemon, usage: Math.round(e.usage * 1000) / 10 }))
        .sort((a, b) => b.usage - a.usage)
        .slice(0, limit);
}
