import type { UsageStatistics } from "smogon";
import { toID } from "./data-loader.js";
import { resolveStatsFormat } from "./regulations/stats-mapping.js";

// --- Caches ---

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cache for format indexes (lightweight: info + usage map)
const indexCache = new Map<string, { data: FormatIndex; timestamp: number }>();

// Cache for individual Pokemon stats
const pokemonCache = new Map<string, { data: PokemonStats; timestamp: number }>();

// --- Types ---

interface FormatIndex {
    info: UsageStatistics["info"];
    pokemon: Record<string, number>; // displayName → usage
    version: number;
}

interface PokemonStats {
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
 * Used by tools that need all Pokemon: getMetaThreats, getMetagameStats.
 */
async function getFormatIndex(format: string, env: Env): Promise<FormatIndex | null> {
    const now = Date.now();
    const cached = indexCache.get(format);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const index = (await env.POKEMON_STATS.get(
            `${format}:_index`,
            "json",
        )) as FormatIndex | null;
        if (index && index.version === 2) {
            indexCache.set(format, { data: index, timestamp: now });
            return index;
        }
    } catch (e) {
        console.error(`Error fetching index for ${format}:`, e);
    }

    return null;
}

/**
 * Get stats for a single Pokemon in a format.
 * Used by per-Pokemon tools: getPopularSets, getTeammates, getChecksCounters.
 */
async function getPokemonStats(
    pokemonName: string,
    format: string,
    env: Env,
): Promise<PokemonStats | null> {
    const pokemonId = toID(pokemonName);
    const cacheKey = `${format}:${pokemonId}`;
    const now = Date.now();

    const cached = pokemonCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const stats = (await env.POKEMON_STATS.get(
            `${format}:${pokemonId}`,
            "json",
        )) as PokemonStats | null;
        if (stats && stats.displayName) {
            pokemonCache.set(cacheKey, { data: stats, timestamp: now });
            return stats;
        }
    } catch (e) {
        console.error(`Error fetching ${pokemonId} stats for ${format}:`, e);
    }

    return null;
}

/**
 * User-facing message for formats that have no KV data yet. Champions
 * regulations will auto-discover once Smogon publishes usage stats for them;
 * until then queries hit this branch and we want the caller to know why.
 */
function unavailableStatsMessage(format: string): string {
    if (format.startsWith("champions-")) {
        return (
            `No usage statistics found for format "${format}". ` +
            "Pokémon Champions usage stats are not yet published on Smogon. " +
            "If Smogon begins publishing a matching gen9champions… identifier, " +
            "set showdownFormatId on the regulation and the monthly ingestion will " +
            "pick it up automatically."
        );
    }
    return `No usage statistics found for format "${format}".`;
}

/**
 * Shared preamble for stats tool entry points: apply the default, remap a
 * Champions regulation id to its Showdown id if one is configured, and
 * short-circuit with a clear message if the regulation has no mapping yet.
 *
 * Returns a tuple of (kvFormatId, displayFormatId, earlyResponse). When
 * earlyResponse is non-null, the tool should return it immediately without
 * hitting KV.
 */
function resolveFormatForLookup(requested: string | undefined): {
    kvId: string;
    displayId: string;
    earlyResponse: string | null;
} {
    const input = requested || "gen9ou";
    const resolved = resolveStatsFormat(input);
    if (resolved.championsUnmapped) {
        return {
            kvId: input,
            displayId: input,
            earlyResponse: unavailableStatsMessage(input),
        };
    }
    return { kvId: resolved.resolvedId, displayId: resolved.originalId, earlyResponse: null };
}

// --- Tool Functions ---

/**
 * Get the most popular sets for a Pokemon from usage stats
 */
export async function getPopularSets(
    args: {
        pokemon: string;
        format?: string;
    },
    env: Env,
): Promise<string> {
    const { kvId, displayId, earlyResponse } = resolveFormatForLookup(args.format);
    if (earlyResponse) return earlyResponse;

    const pokemonStats = await getPokemonStats(args.pokemon, kvId, env);

    if (!pokemonStats) {
        const index = await getFormatIndex(kvId, env);
        if (!index) {
            return unavailableStatsMessage(displayId);
        }
        return `${args.pokemon} not found in ${displayId} usage statistics.`;
    }

    let output = `**${args.pokemon} in ${displayId.toUpperCase()}**\n\n`;
    output += `**Usage:** ${(pokemonStats.usage * 100).toFixed(2)}%\n\n`;

    // Helper to normalize values (chaos format uses weighted counts, not percentages)
    const normalize = (data: Record<string, number>) => {
        const total = Object.values(data).reduce((sum, v) => sum + v, 0);
        if (total === 0) return [];
        return Object.entries(data)
            .map(([key, value]) => [key, (value / total) * 100] as [string, number])
            .sort(([, a], [, b]) => b - a);
    };

    // Abilities
    if (pokemonStats.Abilities) {
        output += "**Popular Abilities:**\n";
        const abilities = normalize(pokemonStats.Abilities).slice(0, 3);
        for (const [ability, pct] of abilities) {
            output += `- ${ability}: ${pct.toFixed(1)}%\n`;
        }
        output += "\n";
    }

    // Items
    if (pokemonStats.Items) {
        output += "**Popular Items:**\n";
        const items = normalize(pokemonStats.Items).slice(0, 5);
        for (const [item, pct] of items) {
            output += `- ${item}: ${pct.toFixed(1)}%\n`;
        }
        output += "\n";
    }

    // Moves
    if (pokemonStats.Moves) {
        output += "**Popular Moves:**\n";
        const moves = normalize(pokemonStats.Moves).slice(0, 8);
        for (const [move, pct] of moves) {
            output += `- ${move}: ${pct.toFixed(1)}%\n`;
        }
        output += "\n";
    }

    // Spreads
    if (pokemonStats.Spreads) {
        output += "**Common EV Spreads:**\n";
        const spreads = normalize(pokemonStats.Spreads).slice(0, 3);
        for (const [spread, pct] of spreads) {
            output += `- ${spread}: ${pct.toFixed(1)}%\n`;
        }
        output += "\n";
    }

    // Tera Types (Gen 9 only — detected from the Showdown-side id since
    // Champions regulations map onto gen9vgc stats files).
    if (pokemonStats["Tera Types"] && kvId.startsWith("gen9")) {
        const teraTypes = normalize(pokemonStats["Tera Types"])
            .filter(([type]) => type.toLowerCase() !== "nothing")
            .slice(0, 5);

        if (teraTypes.length > 0) {
            output += "**Popular Tera Types:**\n";
            for (const [type, pct] of teraTypes) {
                const displayType = type.charAt(0).toUpperCase() + type.slice(1);
                output += `- ${displayType}: ${pct.toFixed(1)}%\n`;
            }
        }
    }

    return output;
}

/**
 * Get the top threats in the metagame by usage
 */
export async function getMetaThreats(
    args: { format?: string; limit?: number },
    env: Env,
): Promise<string> {
    const { kvId, displayId, earlyResponse } = resolveFormatForLookup(args.format);
    if (earlyResponse) return earlyResponse;
    const limit = args.limit || 20;

    const index = await getFormatIndex(kvId, env);

    if (!index) {
        return unavailableStatsMessage(displayId);
    }

    const threats = Object.entries(index.pokemon)
        .map(([name, usage]) => ({ name, usage }))
        .sort((a, b) => b.usage - a.usage)
        .slice(0, limit);

    let output = `**Top ${limit} Threats in ${displayId.toUpperCase()}:**\n\n`;

    for (let i = 0; i < threats.length; i++) {
        const threat = threats[i];
        output += `${i + 1}. **${threat.name}** - ${(threat.usage * 100).toFixed(2)}% usage\n`;
    }

    return output;
}

/**
 * Get common teammates for a Pokemon
 */
export async function getTeammates(
    args: {
        pokemon: string;
        format?: string;
        limit?: number;
    },
    env: Env,
): Promise<string> {
    const { kvId, displayId, earlyResponse } = resolveFormatForLookup(args.format);
    if (earlyResponse) return earlyResponse;
    const limit = args.limit || 10;

    const pokemonStats = await getPokemonStats(args.pokemon, kvId, env);

    if (!pokemonStats) {
        const index = await getFormatIndex(kvId, env);
        if (!index) {
            return unavailableStatsMessage(displayId);
        }
        return `${args.pokemon} not found in ${displayId} usage statistics.`;
    }

    if (!pokemonStats.Teammates) {
        return `No teammate data available for ${args.pokemon} in ${displayId}.`;
    }

    // Normalize teammate values (chaos format uses weighted counts)
    const teammateValues = pokemonStats.Teammates as Record<string, number>;
    const total = Object.values(teammateValues).reduce((sum, v) => sum + v, 0);
    const teammates = Object.entries(teammateValues)
        .map(([key, value]) => [key, total > 0 ? (value / total) * 100 : 0] as [string, number])
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit);

    let output = `**Common Teammates for ${args.pokemon} in ${displayId.toUpperCase()}:**\n\n`;

    for (const [teammate, pct] of teammates) {
        output += `- **${teammate}**: ${pct.toFixed(1)}%\n`;
    }

    return output;
}

/**
 * Get checks and counters for a Pokemon
 */
export async function getChecksCounters(
    args: {
        pokemon: string;
        format?: string;
        limit?: number;
    },
    env: Env,
): Promise<string> {
    const { kvId, displayId, earlyResponse } = resolveFormatForLookup(args.format);
    if (earlyResponse) return earlyResponse;
    const limit = args.limit || 15;

    const pokemonStats = await getPokemonStats(args.pokemon, kvId, env);

    if (!pokemonStats) {
        const index = await getFormatIndex(kvId, env);
        if (!index) {
            return unavailableStatsMessage(displayId);
        }
        return `${args.pokemon} not found in ${displayId} usage statistics.`;
    }

    if (!pokemonStats["Checks and Counters"]) {
        return `No checks and counters data available for ${args.pokemon} in ${displayId}.`;
    }

    const checksCounters = Object.entries(pokemonStats["Checks and Counters"])
        .map(([name, data]: [string, any]) => ({
            name,
            score: data[0],
            koed: data[1],
            switched: data[2],
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    let output = `**Checks and Counters for ${args.pokemon} in ${displayId.toUpperCase()}:**\n\n`;
    output +=
        "(Score: higher = more effective. KOed % = KO rate, Switched % = switch out rate)\n\n";

    for (const check of checksCounters) {
        output += `- **${check.name}**: Score ${check.score.toFixed(2)} (${check.koed.toFixed(1)}% KOed, ${check.switched.toFixed(1)}% switched)\n`;
    }

    return output;
}

/**
 * Get overall metagame statistics
 */
export async function getMetagameStats(args: { format?: string }, env: Env): Promise<string> {
    const { kvId, displayId, earlyResponse } = resolveFormatForLookup(args.format);
    if (earlyResponse) return earlyResponse;

    const index = await getFormatIndex(kvId, env);

    if (!index) {
        return unavailableStatsMessage(displayId);
    }

    const totalPokemon = Object.keys(index.pokemon).length;

    let output = `**Metagame Statistics for ${displayId.toUpperCase()}:**\n\n`;
    output += `- **Total Pokemon:** ${totalPokemon}\n`;
    output += `- **Total Battles:** ${index.info["number of battles"].toLocaleString()}\n`;
    output += `- **Average Weight/Team:** ${index.info["avg weight/team"]}\n\n`;

    // Get usage tiers
    const usageTiers = {
        "S Tier (>10%)": 0,
        "A Tier (5-10%)": 0,
        "B Tier (2-5%)": 0,
        "C Tier (1-2%)": 0,
        "D Tier (<1%)": 0,
    };

    for (const usage of Object.values(index.pokemon)) {
        const pct = usage * 100;
        if (pct > 10) usageTiers["S Tier (>10%)"]++;
        else if (pct > 5) usageTiers["A Tier (5-10%)"]++;
        else if (pct > 2) usageTiers["B Tier (2-5%)"]++;
        else if (pct > 1) usageTiers["C Tier (1-2%)"]++;
        else usageTiers["D Tier (<1%)"]++;
    }

    output += "**Usage Tiers:**\n";
    for (const [tier, count] of Object.entries(usageTiers)) {
        output += `- ${tier}: ${count} Pokemon\n`;
    }

    return output;
}
