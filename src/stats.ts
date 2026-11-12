/**
 * Current-month usage statistics from the POKEMON_STATS KV namespace: the
 * loaders and parsing the connector's usage tools build on
 * (src/connector/usage.ts).
 */
import type { UsageStatistics } from "smogon";
import { BoundedTtlCache } from "./bounded-cache.js";
import { toID } from "./data-loader.js";

// --- Caches ---

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Format indexes are small (info + a usage map) and there is one per regulation.
const indexCache = new BoundedTtlCache<FormatIndex>(8, CACHE_TTL_MS);

// One Pokémon's record runs from tens of kilobytes to about a megabyte in
// memory for the most used ones, and every session on a machine shares this
// cache. Keep only enough to serve the follow-up questions about the Pokémon
// just looked at (usage, then teammates, then checks and counters).
const pokemonCache = new BoundedTtlCache<PokemonStats>(16, CACHE_TTL_MS);

// --- Types ---

export interface FormatIndex {
    info: UsageStatistics["info"];
    pokemon: Record<string, number>; // displayName → usage
    version: number;
}

export interface PokemonStats {
    displayName: string;
    usage: number;
    Abilities?: Record<string, number>;
    Items?: Record<string, number>;
    Moves?: Record<string, number>;
    Spreads?: Record<string, number>;
    Teammates?: Record<string, number>;
    "Checks and Counters"?: Record<string, any>;
    "Tera Types"?: Record<string, number>;
    [key: string]: any;
}

// --- Data Access ---

/**
 * Get the format index (info + pokemon usage map).
 * Used by the tools that rank every Pokémon in a format.
 */
export async function getFormatIndex(format: string, env: Env): Promise<FormatIndex | null> {
    const cached = indexCache.get(format);
    if (cached) return cached;

    try {
        const index = (await env.POKEMON_STATS.get(
            `${format}:_index`,
            "json",
        )) as FormatIndex | null;
        if (index && index.version === 2) {
            indexCache.set(format, index);
            return index;
        }
    } catch (e) {
        console.error(`Error fetching index for ${format}:`, e);
    }

    return null;
}

/**
 * Get stats for a single Pokemon in a format.
 * Used by the per-Pokémon tools.
 */
export async function getPokemonStats(
    pokemonName: string,
    format: string,
    env: Env,
): Promise<PokemonStats | null> {
    const pokemonId = toID(pokemonName);
    const cacheKey = `${format}:${pokemonId}`;

    const cached = pokemonCache.get(cacheKey);
    if (cached) return cached;

    try {
        const stats = (await env.POKEMON_STATS.get(
            `${format}:${pokemonId}`,
            "json",
        )) as PokemonStats | null;
        if (stats?.displayName) {
            pokemonCache.set(cacheKey, stats);
            return stats;
        }
    } catch (e) {
        console.error(`Error fetching ${pokemonId} stats for ${format}:`, e);
    }

    return null;
}

/**
 * A single parsed "Checks and Counters" entry.
 */
export interface CheckCounterEntry {
    name: string;
    /** Smogon's checks/counters rating: (p − 4·d) × 100 */
    score: number;
    /** Raw win rate p as a percentage (KOs or forces a switch) */
    winRate: number;
    /** Number of encounters (rounded) */
    sampleSize: number;
}

/**
 * Parse the raw Smogon chaos "Checks and Counters" data into scored entries.
 *
 * Each raw entry is `{ n, p, d }` where n = number of encounters, p = fraction
 * of encounters where the counter "wins" (KOs the target or forces it out),
 * and d = the standard deviation of p. Smogon's standard rating is p − 4·d,
 * displayed ×100. Entries are sorted by rating descending.
 */
export function parseChecksCounters(
    data: Record<string, { n: number; p: number; d: number }>,
    limit: number,
): CheckCounterEntry[] {
    return Object.entries(data)
        .map(([name, { n, p, d }]) => ({
            name,
            score: (p - 4 * d) * 100,
            winRate: p * 100,
            sampleSize: Math.round(n),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}
