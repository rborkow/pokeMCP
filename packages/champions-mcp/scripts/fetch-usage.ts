/**
 * Fetch Smogon chaos usage for the current Champions ladder into data/usage/.
 * Writes {format}-{YYYY-MM}.json.gz (trimmed + gzipped). Idempotent; re-run monthly.
 *   bun run scripts/fetch-usage.ts                   # latest month, cutoff 1630
 *   CUTOFF=1760 MONTH=2026-08 bun run scripts/fetch-usage.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { CHAMPIONS_FORMAT_ID } from "../src/showdown.js";
import { USAGE_DIR, type UsageBlob, type UsageEntry } from "../src/usage.js";

// Keep the previous regulation for trend context / fallback until the new one is published.
const FORMATS = [CHAMPIONS_FORMAT_ID, "gen9championsvgc2026regmb"];
const CUTOFF = Number(process.env.CUTOFF ?? 1630);
const UA = "pokemcp-champions-mcp/0.1 (+https://pokemcp.com)";

// Trim policy: the raw chaos dump is ~14 MB (283 Pokémon x full teammate/spread
// maps). Anything under 0.5% usage is noise, and long tails per field add
// megabytes nobody reads. Keeping top-N by count caps the cache under 1 MB gz.
const MIN_USAGE = 0.005;
const TOP_N = {
    Abilities: 5,
    Items: 15,
    Moves: 20,
    Spreads: 15,
    Teammates: 25,
    "Checks and Counters": 25,
} as const;

async function latestMonth(): Promise<string> {
    if (process.env.MONTH) return process.env.MONTH;
    const res = await fetch("https://www.smogon.com/stats/", { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`Could not list months at smogon.com/stats: HTTP ${res.status}`);
    const months = [...(await res.text()).matchAll(/href="(\d{4}-\d{2})\/"/g)]
        .map((m) => m[1])
        .sort();
    if (months.length === 0) throw new Error("Could not list months at smogon.com/stats");
    return months[months.length - 1];
}

/**
 * Smogon chaos dumps publish Checks-and-Counters values either as
 * `[n, p, d]` arrays or `{n, p, d}` objects depending on month; normalize
 * to the object form so consumers can rely on it.
 */
function normaliseCounters(raw: unknown): UsageEntry["Checks and Counters"] {
    const out: UsageEntry["Checks and Counters"] = {};
    if (!raw || typeof raw !== "object") return out;
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
        if (Array.isArray(value)) {
            out[name] = {
                n: Number(value[0]) || 0,
                p: Number(value[1]) || 0,
                d: Number(value[2]) || 0,
            };
        } else if (value && typeof value === "object") {
            const v = value as { n?: unknown; p?: unknown; d?: unknown };
            out[name] = { n: Number(v.n) || 0, p: Number(v.p) || 0, d: Number(v.d) || 0 };
        }
    }
    return out;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Sum of a `{key: count}` map — the honest denominator once topNCounts trims it. */
function sumCounts(map: Record<string, number>): number {
    return Object.values(map).reduce((a, b) => a + b, 0);
}

/** Keep the top-N entries of a `{key: count}` map, rounded to 1 decimal. */
function topNCounts(map: Record<string, number>, n: number): Record<string, number> {
    return Object.fromEntries(
        Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, n)
            .map(([k, v]) => [k, round1(v)]),
    );
}

/** Same for Checks-and-Counters, ranked by `n` (encounter count). Only `n` is
 * a count — `p`/`d` stay full-precision; get_usage's score depends on them. */
function topNCounters(
    map: UsageEntry["Checks and Counters"],
    n: number,
): UsageEntry["Checks and Counters"] {
    return Object.fromEntries(
        Object.entries(map)
            .sort((a, b) => b[1].n - a[1].n)
            .slice(0, n)
            .map(([k, v]) => [k, { n: round1(v.n), p: v.p, d: v.d }]),
    );
}

const month = await latestMonth();
mkdirSync(USAGE_DIR, { recursive: true });
for (const format of FORMATS) {
    const url = `https://www.smogon.com/stats/${month}/chaos/${format}-${CUTOFF}.json`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) {
        console.warn(`skip ${format} ${month}: HTTP ${res.status} (${url})`);
        continue;
    }
    const raw = (await res.json()) as {
        info?: { "number of battles"?: number };
        data?: Record<string, Partial<UsageEntry> & Record<string, unknown>>;
    };
    const pokemon: UsageBlob["pokemon"] = {};
    let survivors = 0;
    for (const [name, e] of Object.entries(raw.data ?? {})) {
        const usage = Number(e.usage) || 0;
        if (usage < MIN_USAGE) continue;
        survivors++;
        // Capture the FULL map totals before topNCounts trims the tails away;
        // src/usage.ts divides by these so shares stay true percentages of
        // all battles rather than of whatever survived the trim.
        const rawMaps = {
            Abilities: (e.Abilities ?? {}) as Record<string, number>,
            Items: (e.Items ?? {}) as Record<string, number>,
            Spreads: (e.Spreads ?? {}) as Record<string, number>,
            Moves: (e.Moves ?? {}) as Record<string, number>,
            Teammates: (e.Teammates ?? {}) as Record<string, number>,
        };
        pokemon[name] = {
            usage,
            Abilities: topNCounts(rawMaps.Abilities, TOP_N.Abilities),
            Items: topNCounts(rawMaps.Items, TOP_N.Items),
            Spreads: topNCounts(rawMaps.Spreads, TOP_N.Spreads),
            Moves: topNCounts(rawMaps.Moves, TOP_N.Moves),
            Teammates: topNCounts(rawMaps.Teammates, TOP_N.Teammates),
            "Checks and Counters": topNCounters(
                normaliseCounters(e["Checks and Counters"]),
                TOP_N["Checks and Counters"],
            ),
            _totals: {
                Abilities: sumCounts(rawMaps.Abilities),
                Items: sumCounts(rawMaps.Items),
                Spreads: sumCounts(rawMaps.Spreads),
                Moves: sumCounts(rawMaps.Moves),
                Teammates: sumCounts(rawMaps.Teammates),
            },
        };
    }
    const battles = Number(raw.info?.["number of battles"]) || 0;
    const blob: UsageBlob = {
        format,
        month,
        cutoff: CUTOFF,
        battles,
        pokemon,
        trimmed: { minUsage: MIN_USAGE, topN: { ...TOP_N } },
    };
    const file = join(USAGE_DIR, `${format}-${month}.json.gz`);
    // no pretty-print: gzip does the compressing
    writeFileSync(file, gzipSync(JSON.stringify(blob), { level: 9 }));
    console.log(
        `wrote ${file} (${survivors}/${Object.keys(raw.data ?? {}).length} Pokémon ≥ ${MIN_USAGE} usage, ${battles} battles)`,
    );
    await new Promise((r) => setTimeout(r, 2000)); // be polite to Smogon
}
