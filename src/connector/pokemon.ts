/**
 * Connector tools backed only by the bundled Pokémon Showdown data: Pokémon
 * lookup, moveset legality and defensive type analysis. No bindings needed.
 */
import {
    getAllPokemonNames,
    getFullLearnset,
    getMove,
    getPokemon,
    getTypeChart,
    toID,
} from "../data-loader.js";
import type { MegaForm } from "../regulations/mega-data.js";
import { REGULATIONS } from "../regulations/registry.js";
import type { PokemonSpecies } from "../types.js";
import { fail, ok, type ToolOutcome } from "./types.js";

// --- Pokémon name resolution ---

/** Resolve a real Pokémon (not a fan-made or placeholder entry) by name. */
export function findPokemon(name: string): PokemonSpecies | undefined {
    const species = getPokemon(name);
    return species && species.num > 0 ? species : undefined;
}

/** A Mega Evolution the regulations define, by its form name ("Charizard-Mega-Y"). */
export function findMegaForm(name: string): MegaForm | undefined {
    const id = toID(name);
    const newestFirst = [...REGULATIONS].sort((a, b) => b.startDate.localeCompare(a.startDate));
    for (const regulation of newestFirst) {
        const form = regulation.megaForms.find((f) => toID(f.megaName) === id || f.formId === id);
        if (form) return form;
    }
    return undefined;
}

export interface ResolvedPokemon {
    /** Display name — the Mega's own name when a Mega was asked for. */
    name: string;
    /** Dex entry. For a Mega the dex does not model, this is its base Pokémon. */
    species: PokemonSpecies;
    /** Set when the name is a Mega Evolution the regulations define. */
    mega?: MegaForm;
    /** A "-Mega" name whose base Pokémon is known but whose own data is not. */
    unknownMega?: boolean;
    /** Typing to analyse: post-Mega for a Mega, when known. */
    types: string[];
}

/**
 * Resolve a name the way the usage tools report them. Usage statistics list
 * Mega Evolutions as their own entries, including Champions-only Megas the
 * bundled dex lacks, so every tool has to accept those names back.
 */
export function resolvePokemon(input: string): ResolvedPokemon | undefined {
    const mega = findMegaForm(input);
    const species = findPokemon(input);
    if (species) return { name: species.name, species, mega, types: species.types };

    if (mega) {
        const base = findPokemon(mega.basePokemon);
        if (base) {
            return {
                name: mega.megaName,
                species: base,
                mega,
                types: mega.postMegaTypes ?? base.types,
            };
        }
    }

    const megaSuffix = input.trim().match(/^(.+?)[\s-]mega(?:[\s-][xyz])?$/i);
    const base = megaSuffix && findPokemon(megaSuffix[1]);
    if (base) return { name: input.trim(), species: base, unknownMega: true, types: base.types };
    return undefined;
}

/** Up to three known names that start with, or contain, the caller's input. */
function suggestNames(input: string): string[] {
    const id = toID(input);
    if (id.length < 3) return [];
    const names = getAllPokemonNames();
    const starts = names.filter((n) => toID(n).startsWith(id));
    const contains = names.filter((n) => !toID(n).startsWith(id) && toID(n).includes(id));
    return [...starts, ...contains].slice(0, 3);
}

export function pokemonNotFound(input: string): string {
    const suggestions = suggestNames(input);
    const hint = suggestions.length ? ` Did you mean ${suggestions.join(", ")}?` : "";
    return (
        `No Pokémon named "${input}" was found.${hint} Use the English name; alternate forms ` +
        `are hyphenated, for example "Landorus-Therian" or "Charizard-Mega-Y".`
    );
}

// --- lookup_pokemon ---

const STAT_LABELS = [
    ["hp", "HP"],
    ["atk", "Atk"],
    ["def", "Def"],
    ["spa", "SpA"],
    ["spd", "SpD"],
    ["spe", "Spe"],
] as const;

function statLine(stats: Record<string, number>): string {
    return STAT_LABELS.map(([key, label]) => `${stats[key]} ${label}`).join(" / ");
}

export function lookupPokemon(args: { pokemon: string }): ToolOutcome {
    const resolved = resolvePokemon(args.pokemon);
    if (!resolved) return fail(pokemonNotFound(args.pokemon));
    const { species, mega } = resolved;
    if (resolved.unknownMega) {
        return fail(
            `${resolved.name} is not in this connector's Pokémon data yet. Look up its base ` +
                `form, ${species.name}, instead; the usage tools do recognise ${resolved.name}.`,
        );
    }
    // A Mega the dex does not model: describe it from the regulation's data.
    const fromRegistry = mega !== undefined && toID(species.name) !== toID(mega.megaName);

    const { hp, atk, def, spa, spd, spe } =
        (fromRegistry && mega.postMegaBaseStats) || species.baseStats;
    const baseStats = { hp, atk, def, spa, spd, spe, total: hp + atk + def + spa + spd + spe };

    const abilities: { name: string; hidden: boolean }[] = [];
    if (fromRegistry && mega.postMegaAbility) {
        abilities.push({ name: mega.postMegaAbility, hidden: false });
    } else {
        for (const slot of ["0", "1", "H", "S"] as const) {
            const name = species.abilities[slot];
            if (name) abilities.push({ name, hidden: slot === "H" });
        }
    }

    // Mega Evolutions come from the regulation registry rather than the dex,
    // because it carries Champions-only Megas and says where each is legal.
    const baseName = fromRegistry ? species.name : species.baseSpecies || species.name;
    const megas = new Map<
        string,
        {
            name: string;
            megaStone: string;
            types?: string[];
            ability?: string;
            baseStats?: typeof baseStats;
            formats: string[];
        }
    >();
    for (const regulation of REGULATIONS) {
        for (const form of regulation.megaForms) {
            if (toID(form.basePokemon) !== toID(baseName)) continue;
            const existing = megas.get(form.megaName);
            if (existing) {
                existing.formats.push(regulation.id);
                continue;
            }
            const s = form.postMegaBaseStats;
            megas.set(form.megaName, {
                name: form.megaName,
                megaStone: form.megaStone,
                ...(form.postMegaTypes ? { types: form.postMegaTypes } : {}),
                ...(form.postMegaAbility ? { ability: form.postMegaAbility } : {}),
                ...(s
                    ? {
                          baseStats: {
                              ...s,
                              total: s.hp + s.atk + s.def + s.spa + s.spd + s.spe,
                          },
                      }
                    : {}),
                formats: [regulation.id],
            });
        }
    }
    const megaEvolutions = [...megas.values()];

    const weightKg = fromRegistry ? undefined : species.weightkg;
    const data = {
        name: resolved.name,
        dexNumber: species.num,
        types: resolved.types,
        baseStats,
        abilities,
        ...(weightKg ? { weightKg } : {}),
        ...(baseName !== resolved.name ? { baseSpecies: baseName } : {}),
        otherForms: fromRegistry ? [] : (species.otherFormes ?? []),
        megaEvolutions,
    };

    const lines = [
        `**${data.name}** — ${data.types.join(" / ")} (National Dex #${species.num})`,
        "",
        `Base stats: ${statLine(baseStats)} (total ${baseStats.total})`,
        `Abilities: ${abilities.map((a) => (a.hidden ? `${a.name} (hidden)` : a.name)).join(", ")}`,
    ];
    if (weightKg) lines.push(`Weight: ${weightKg} kg`);
    if (data.otherForms.length) lines.push(`Other forms: ${data.otherForms.join(", ")}`);
    for (const mega of megaEvolutions) {
        const parts = [
            mega.types?.join(" / "),
            mega.ability,
            mega.baseStats && statLine(mega.baseStats),
        ]
            .filter(Boolean)
            .join("; ");
        lines.push(
            `Mega Evolution: **${mega.name}** with ${mega.megaStone}` +
                `${parts ? ` — ${parts}` : ""} (legal in ${mega.formats.join(", ")})`,
        );
    }
    return ok(data, lines.join("\n"));
}

// --- validate_moveset ---

const LEARN_METHODS: Record<string, string> = {
    L: "level-up",
    M: "TM",
    T: "move tutor",
    E: "Egg move",
    S: "event distribution",
    D: "Dream World",
    V: "Virtual Console transfer",
    R: "move reminder",
};

/** Describe the most recent way a move is learned, e.g. "TM (Gen 9)". */
function describeSource(sources: string[]): string {
    const best = [...sources].sort((a, b) => Number.parseInt(b, 10) - Number.parseInt(a, 10))[0];
    const generation = Number.parseInt(best, 10);
    const method = LEARN_METHODS[best[String(generation).length]] ?? "other";
    return `${method} (Gen ${generation})`;
}

export function validateMoveset(args: { pokemon: string; moves: string[] }): ToolOutcome {
    const resolved = resolvePokemon(args.pokemon);
    if (!resolved) return fail(pokemonNotFound(args.pokemon));
    // A Mega Evolution knows exactly the moves of its base Pokémon.
    const species = { name: resolved.name };

    const learnset = getFullLearnset(resolved.species.name);
    if (!learnset) {
        return fail(
            `No move data is available for ${species.name}, so its moves can't be checked. ` +
                "This usually means the Pokémon is newer than the bundled game data.",
        );
    }

    const moves = args.moves.map((input) => {
        const move = getMove(input);
        if (!move) {
            return { move: input, learnable: false, detail: "No move with this name exists." };
        }
        const sources = learnset[toID(move.name)];
        if (!sources) {
            return {
                move: move.name,
                learnable: false,
                detail: `${species.name} can't learn this move, including through its pre-evolutions.`,
            };
        }
        return {
            move: move.name,
            learnable: true,
            detail: `Learned by ${describeSource(sources)}.`,
        };
    });

    const allLearnable = moves.every((m) => m.learnable);
    const data = { pokemon: species.name, allLearnable, moves };
    const text = [
        `**${species.name}** — ${allLearnable ? "every move is learnable" : "some moves are not learnable"}`,
        "",
        ...moves.map((m) => `- ${m.learnable ? "✅" : "❌"} ${m.move}: ${m.detail}`),
    ].join("\n");
    return ok(data, text);
}

// --- analyze_team_types ---

/** The 18 attacking types, capitalised as the type chart keys them. */
const ATTACKING_TYPES = Object.keys(getTypeChart())
    .filter((id) => id !== "stellar")
    .map((id) => id.charAt(0).toUpperCase() + id.slice(1));

/**
 * Damage multiplier an attacking type deals to a defender's typing.
 * Showdown's `damageTaken` codes: 0 neutral, 1 weak, 2 resists, 3 immune.
 */
function multiplier(attackingType: string, defenderTypes: string[]): number {
    const chart = getTypeChart();
    let total = 1;
    for (const defenderType of defenderTypes) {
        const code = chart[defenderType.toLowerCase()]?.damageTaken?.[attackingType];
        if (code === 3) return 0;
        if (code === 2) total *= 0.5;
        else if (code === 1) total *= 2;
    }
    return total;
}

export function analyzeTeamTypes(args: { team: string[] }): ToolOutcome {
    const team: { name: string; types: string[] }[] = [];
    const notFound: string[] = [];
    for (const input of args.team) {
        // A Mega without type data can't be analysed; its base typing would mislead.
        const resolved = resolvePokemon(input);
        if (resolved && !resolved.unknownMega) {
            team.push({ name: resolved.name, types: resolved.types });
        } else {
            notFound.push(input);
        }
    }
    if (team.length === 0) return fail(pokemonNotFound(notFound[0] ?? ""));

    const matchups = ATTACKING_TYPES.map((type) => {
        const weak: string[] = [];
        const resist: string[] = [];
        const immune: string[] = [];
        for (const member of team) {
            const m = multiplier(type, member.types);
            if (m === 0) immune.push(member.name);
            else if (m > 1) weak.push(member.name);
            else if (m < 1) resist.push(member.name);
        }
        return { type, weak, resist, immune };
    });

    const sharedWeaknesses = matchups
        .filter((m) => m.weak.length >= 2)
        .sort((a, b) => b.weak.length - a.weak.length)
        .map((m) => m.type);
    const unresisted = matchups
        .filter((m) => m.resist.length === 0 && m.immune.length === 0)
        .map((m) => m.type);

    // Types worth adding: those that resist, or are immune to, the most of
    // the team's shared weaknesses (or any weakness if none are shared).
    const gaps = sharedWeaknesses.length
        ? sharedWeaknesses
        : matchups.filter((m) => m.weak.length > 0).map((m) => m.type);
    const suggestedTypes = ATTACKING_TYPES.map((type) => ({
        type,
        covers: gaps.filter((gap) => multiplier(gap, [type]) < 1),
    }))
        .filter((s) => s.covers.length > 0)
        .sort((a, b) => b.covers.length - a.covers.length)
        .slice(0, 5);

    const data = { team, notFound, matchups, sharedWeaknesses, unresisted, suggestedTypes };

    const count = (names: string[]) =>
        names.length ? `${names.length} (${names.join(", ")})` : "0";
    const lines = [
        `**Defensive type analysis** — ${team.map((m) => `${m.name} (${m.types.join("/")})`).join(", ")}`,
    ];
    if (notFound.length) lines.push(`Not recognised and skipped: ${notFound.join(", ")}`);
    lines.push(
        "",
        `Shared weaknesses (2+ Pokémon weak): ${sharedWeaknesses.join(", ") || "none"}`,
        `No resistance or immunity to: ${unresisted.join(", ") || "none"}`,
        "",
        "| Attacking type | Weak | Resist | Immune |",
        "|---|---|---|---|",
        ...matchups.map(
            (m) => `| ${m.type} | ${count(m.weak)} | ${count(m.resist)} | ${count(m.immune)} |`,
        ),
    );
    if (suggestedTypes.length) {
        lines.push(
            "",
            "Types that would patch the most gaps: " +
                suggestedTypes.map((s) => `${s.type} (covers ${s.covers.join(", ")})`).join("; "),
        );
    }
    return ok(data, lines.join("\n"));
}
