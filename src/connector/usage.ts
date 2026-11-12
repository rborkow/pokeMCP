/**
 * Connector tools over the current month's usage statistics (POKEMON_STATS
 * KV): the usage ranking, one Pokémon's set breakdown, teammates, and checks
 * and counters. Each is its own tool rather than a mode of one, so a client
 * can review and select them individually.
 */
import { getAbility, getItem, getMove, getPokemon } from "../data-loader.js";
import type { RegulationSet } from "../regulations/types.js";
import {
    type FormatIndex,
    getFormatIndex,
    getPokemonStats,
    type PokemonStats,
    parseChecksCounters,
} from "../stats.js";
import { formatFields, resolveRegulation } from "./formats.js";
import { fail, ok, round2, type ToolOutcome, toPercent } from "./types.js";

// --- Loading ---

type Loaded<T> = { regulation: RegulationSet } & (
    | { ok: false; error: string }
    | { ok: true; value: T }
);

function noStatsYet(regulation: RegulationSet): string {
    return (
        `Usage statistics for ${regulation.shortLabel} have not been published yet. ` +
        "Call list_formats to find a format that has them."
    );
}

function statsUnavailable(regulation: RegulationSet): string {
    return (
        `Usage statistics for ${regulation.shortLabel} are unavailable right now. ` +
        "Try again later, or call list_formats to pick another format."
    );
}

async function loadIndex(format: string | undefined, env: Env): Promise<Loaded<FormatIndex>> {
    const regulation = resolveRegulation(format);
    if (!regulation.showdownFormatId) {
        return { ok: false, regulation, error: noStatsYet(regulation) };
    }
    const index = await getFormatIndex(regulation.showdownFormatId, env);
    if (!index) return { ok: false, regulation, error: statsUnavailable(regulation) };
    return { ok: true, regulation, value: index };
}

/** A Pokémon's stats plus its place in the format's usage ranking. */
async function loadPokemon(
    pokemon: string,
    format: string | undefined,
    env: Env,
): Promise<Loaded<{ stats: PokemonStats; rank: number; weight: number }>> {
    const regulation = resolveRegulation(format);
    if (!regulation.showdownFormatId) {
        return { ok: false, regulation, error: noStatsYet(regulation) };
    }

    const [stats, index] = await Promise.all([
        getPokemonStats(pokemon, regulation.showdownFormatId, env),
        getFormatIndex(regulation.showdownFormatId, env),
    ]);
    if (!index) return { ok: false, regulation, error: statsUnavailable(regulation) };
    if (!stats) {
        const name = getPokemon(pokemon)?.name ?? pokemon;
        return {
            ok: false,
            regulation,
            error:
                `${name} has no recorded usage in ${regulation.shortLabel}. Check the spelling ` +
                `(Mega Evolutions are listed separately, for example "Charizard-Mega-Y"), or ` +
                "call get_top_usage to see which Pokémon are used.",
        };
    }

    const rank = 1 + Object.values(index.pokemon).filter((usage) => usage > stats.usage).length;
    // Every recorded set has exactly one ability, so the ability weights sum to
    // this Pokémon's total weighted count — the denominator for "% of sets".
    const weight = Object.values(stats.Abilities ?? {}).reduce((sum, v) => sum + v, 0);
    return { ok: true, regulation, value: { stats, rank, weight } };
}

/** Top entries of a weighted tally as `{ name, percent }` of the Pokémon's sets. */
function topShares(
    tally: Record<string, number> | undefined,
    weight: number,
    limit: number,
    displayName: (key: string) => string,
): { name: string; percent: number }[] {
    if (!tally || weight <= 0) return [];
    return Object.entries(tally)
        .filter(([key]) => key !== "")
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([key, value]) => ({
            name: displayName(key),
            percent: round2((value / weight) * 100),
        }))
        .filter((entry) => entry.percent > 0);
}

// The chaos files key moves, items and abilities by id ("chopleberry").
const itemName = (id: string) => (id === "nothing" ? "No item" : (getItem(id)?.name ?? id));
const moveName = (id: string) => getMove(id)?.name ?? id;
const abilityName = (id: string) => getAbility(id)?.name ?? id;

const shareList = (entries: { name: string; percent: number }[]) =>
    entries.map((e) => `${e.name} ${e.percent}%`).join(", ") || "no data";

// --- get_top_usage ---

export async function getTopUsage(
    args: { format?: string; limit?: number },
    env: Env,
): Promise<ToolOutcome> {
    const loaded = await loadIndex(args.format, env);
    if (loaded.ok === false) return fail(loaded.error);
    const { regulation, value: index } = loaded;

    const pokemon = Object.entries(index.pokemon)
        .sort(([, a], [, b]) => b - a)
        .slice(0, args.limit ?? 20)
        .map(([name, usage], i) => ({ rank: i + 1, name, usagePercent: toPercent(usage) }));

    const data = {
        ...formatFields(regulation),
        battles: index.info["number of battles"],
        pokemonCount: Object.keys(index.pokemon).length,
        pokemon,
    };
    const text = [
        `**Top ${pokemon.length} Pokémon by usage — ${regulation.shortLabel}**`,
        `${data.battles.toLocaleString("en-US")} battles, ${data.pokemonCount} Pokémon recorded`,
        "",
        ...pokemon.map((p) => `${p.rank}. ${p.name} — ${p.usagePercent}%`),
    ].join("\n");
    return ok(data, text);
}

// --- get_pokemon_usage ---

/** Parse a chaos spread key such as "Adamant:32/32/0/0/2/0". */
function parseSpread(key: string) {
    const [nature, values = ""] = key.split(":");
    const [hp = 0, atk = 0, def = 0, spa = 0, spd = 0, spe = 0] = values.split("/").map(Number);
    return { nature, hp, atk, def, spa, spd, spe };
}

export async function getPokemonUsage(
    args: { pokemon: string; format?: string },
    env: Env,
): Promise<ToolOutcome> {
    const loaded = await loadPokemon(args.pokemon, args.format, env);
    if (loaded.ok === false) return fail(loaded.error);
    const { regulation, value } = loaded;
    const { stats, rank, weight } = value;

    const abilities = topShares(stats.Abilities, weight, 4, abilityName);
    const items = topShares(stats.Items, weight, 8, itemName);
    const moves = topShares(stats.Moves, weight, 10, moveName);
    const spreads = topShares(stats.Spreads, weight, 5, (key) => key).map((s) => ({
        ...parseSpread(s.name),
        percent: s.percent,
    }));

    const data = {
        pokemon: stats.displayName,
        ...formatFields(regulation),
        usagePercent: toPercent(stats.usage),
        rank,
        abilities,
        items,
        moves,
        spreads,
    };
    const text = [
        `**${stats.displayName} — ${regulation.shortLabel}**: ${data.usagePercent}% usage (rank #${rank})`,
        "",
        `Abilities: ${shareList(abilities)}`,
        `Items: ${shareList(items)}`,
        `Moves: ${shareList(moves)}`,
        "Stat spreads (nature, HP/Atk/Def/SpA/SpD/Spe): " +
            (spreads
                .map(
                    (s) =>
                        `${s.nature} ${s.hp}/${s.atk}/${s.def}/${s.spa}/${s.spd}/${s.spe} ${s.percent}%`,
                )
                .join(", ") || "no data"),
    ].join("\n");
    return ok(data, text);
}

// --- get_teammates ---

export async function getTeammates(
    args: { pokemon: string; format?: string; limit?: number },
    env: Env,
): Promise<ToolOutcome> {
    const loaded = await loadPokemon(args.pokemon, args.format, env);
    if (loaded.ok === false) return fail(loaded.error);
    const { regulation, value } = loaded;
    const { stats, weight } = value;

    const teammates = topShares(stats.Teammates, weight, args.limit ?? 10, (key) => key);
    if (teammates.length === 0) {
        return fail(
            `No teammate data is recorded for ${stats.displayName} in ${regulation.shortLabel}.`,
        );
    }

    const data = { pokemon: stats.displayName, ...formatFields(regulation), teammates };
    const text = [
        `**Common teammates of ${stats.displayName} — ${regulation.shortLabel}**`,
        `(share of ${stats.displayName}'s teams that also include the Pokémon)`,
        "",
        ...teammates.map((t) => `- ${t.name}: ${t.percent}%`),
    ].join("\n");
    return ok(data, text);
}

// --- get_checks_and_counters ---

export async function getChecksAndCounters(
    args: { pokemon: string; format?: string; limit?: number },
    env: Env,
): Promise<ToolOutcome> {
    const loaded = await loadPokemon(args.pokemon, args.format, env);
    if (loaded.ok === false) return fail(loaded.error);
    const { regulation, value } = loaded;
    const { stats } = value;

    const raw = stats["Checks and Counters"];
    const entries = raw ? parseChecksCounters(raw, args.limit ?? 10) : [];
    if (entries.length === 0) {
        return fail(
            `No checks-and-counters data is recorded for ${stats.displayName} in ` +
                `${regulation.shortLabel}; it needs enough ladder matchups to be published. ` +
                "Try get_teammates or get_pokemon_usage instead.",
        );
    }

    const checks = entries.map((e) => ({
        name: e.name,
        score: round2(e.score),
        winRatePercent: round2(e.winRate),
        encounters: e.sampleSize,
    }));
    const data = { pokemon: stats.displayName, ...formatFields(regulation), checks };
    const text = [
        `**Checks and counters for ${stats.displayName} — ${regulation.shortLabel}**`,
        "(score = (win rate − 4 × standard deviation) × 100; win rate = share of encounters " +
            "where the listed Pokémon knocked it out or forced it to switch)",
        "",
        ...checks.map(
            (c) =>
                `- ${c.name}: score ${c.score}, win rate ${c.winRatePercent}%, ` +
                `${c.encounters.toLocaleString("en-US")} encounters`,
        ),
    ].join("\n");
    return ok(data, text);
}
