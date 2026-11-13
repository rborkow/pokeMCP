/**
 * Matchup tools: damage ranges, speed order, and how a team fares against the
 * most-used Pokémon.
 *
 * The arithmetic is done by `@smogon/calc`, the open-source calculator behind
 * Pokémon Showdown, in its Pokémon Champions mode (generation 0 in that
 * library): level 50, stat points instead of EVs, and Champions' own species,
 * move and item data. Nothing here plays out a battle. Each result is one
 * calculation under stated conditions.
 *
 * Two things the caller cannot see are spelled out in every result:
 *
 * - Which set was used. When a caller leaves out a Pokémon's nature and stat
 *   points, ability or item, the most common one in the regulation's usage
 *   statistics is used, and the result says so.
 * - Spread moves. In doubles a move that hits both opponents does 75% damage.
 *   That is assumed unless the caller says only one target is left.
 *
 * The calculator is about 900 KB of data for every game generation, so it is
 * loaded on first use and not when the Worker starts.
 */
import type { RegulationSet } from "../regulations/types.js";
import { BoundedTtlCache } from "../bounded-cache.js";
import { getFormatIndex, getPokemonStats, type PokemonStats } from "../stats.js";
import { formatFields, resolveRegulation } from "./formats.js";
import { pokemonNotFound, resolvePokemon } from "./pokemon.js";
import { fail, ok, round2, type ToolOutcome } from "./types.js";

// --- The calculator, loaded on first use ---

// Loosely typed on purpose: the library's own types pull in Node typings, and
// only a small, tested part of its surface is used here.
type Calc = any;
type CalcPokemon = any;

let calcPromise: Promise<{ calc: Calc; getFinalSpeed: Calc }> | null = null;

function loadCalc(): Promise<{ calc: Calc; getFinalSpeed: Calc }> {
    if (!calcPromise) {
        calcPromise = (async () => {
            // The package is CommonJS: depending on the loader its exports sit
            // on the namespace or under `default`.
            const main: Calc = await import("@smogon/calc");
            // `getFinalSpeed` is not part of the package's public index. The
            // dependency is pinned to an exact version and the speed tests pin
            // known values, so a change there fails loudly.
            const util: Calc = await import("@smogon/calc/dist/mechanics/util");
            const calc = main.calculate ? main : main.default;
            const getFinalSpeed = util.getFinalSpeed ?? util.default?.getFinalSpeed;
            return { calc, getFinalSpeed };
        })();
    }
    return calcPromise;
}

// --- Champions rules ---

export const STAT_IDS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
export type StatId = (typeof STAT_IDS)[number];
type StatTable = Record<StatId, number>;

/** A Pokémon has 66 stat points to spend, at most 32 on one stat. */
export const MAX_STAT_POINTS_TOTAL = 66;
export const MAX_STAT_POINTS_PER_STAT = 32;

const STAT_LABELS: Record<StatId, string> = {
    hp: "HP",
    atk: "Atk",
    def: "Def",
    spa: "SpA",
    spd: "SpD",
    spe: "Spe",
};

const STATUS_CODES = { burn: "brn", paralysis: "par" } as const;
const WEATHER = { sun: "Sun", rain: "Rain", sand: "Sand", snow: "Snow" } as const;
const TERRAIN = {
    electric: "Electric",
    grassy: "Grassy",
    misty: "Misty",
    psychic: "Psychic",
} as const;

// Names the usage statistics use that the calculator files under another name.
// "Aegislash-Both" is the calculator's entry with Blade Forme's attack and
// Shield Forme's defences, which is how the Pokémon plays out a turn.
const SPECIES_ALIASES: Record<string, string> = { aegislash: "aegislashboth" };

// --- Inputs ---

export interface SetInput {
    pokemon: string;
    nature?: string;
    statPoints?: Partial<StatTable>;
    ability?: string;
    item?: string;
    boosts?: Partial<Record<Exclude<StatId, "hp">, number>>;
    status?: keyof typeof STATUS_CODES;
}

export interface FieldInput {
    weather?: keyof typeof WEATHER;
    terrain?: keyof typeof TERRAIN;
    reflect?: boolean;
    lightScreen?: boolean;
    auroraVeil?: boolean;
    helpingHand?: boolean;
    friendGuard?: boolean;
    criticalHit?: boolean;
    singleTarget?: boolean;
}

// --- Resolving a set ---

/** The set a calculation actually used, echoed back to the caller. */
export interface SetEcho {
    pokemon: string;
    nature: string;
    statPoints: StatTable;
    ability: string;
    item: string | null;
    stats: StatTable;
    boosts?: Partial<Record<Exclude<StatId, "hp">, number>>;
    status?: string;
}

interface ResolvedSet {
    pokemon: CalcPokemon;
    echo: SetEcho;
    /** What was filled in because the caller left it out. */
    assumptions: string[];
    /** The Pokémon's most common set in the regulation, when usage data was read. */
    typical: TypicalSet | null;
}

/**
 * The few facts these tools need from a usage record. A full record is tens of
 * kilobytes to about a megabyte in memory, so only this summary is kept: it is
 * a few hundred bytes, which lets a threat check that names the same popular
 * Pokémon as the last one skip the read entirely.
 */
interface TypicalSet {
    spread: { nature: string; statPoints: StatTable } | null;
    /** Most used ability id, or null. */
    ability: string | null;
    /** Most used item id, or null when most sets hold none. */
    item: string | null;
    /** Move ids, most used first. */
    moves: string[];
}

const typicalSets = new BoundedTtlCache<TypicalSet>(600, 5 * 60 * 1000);

function summarize(usage: PokemonStats): TypicalSet {
    return {
        spread: parseSpread(topKey(usage.Spreads) ?? ""),
        ability: topKey(usage.Abilities, ["noability"]),
        item: topKey(usage.Items, ["nothing"]),
        moves: Object.entries(usage.Moves ?? {})
            .filter(([id]) => id && id !== "nothing")
            .sort(([, a], [, b]) => b - a)
            .slice(0, 12)
            .map(([id]) => id),
    };
}

type Resolved<T> = { ok: true; value: T } | { ok: false; error: string };

function toId(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function topKey(tally: Record<string, number> | undefined, skip: string[] = []): string | null {
    if (!tally) return null;
    let best: string | null = null;
    let bestWeight = 0;
    for (const [key, weight] of Object.entries(tally)) {
        if (!key || skip.includes(key)) continue;
        if (weight > bestWeight) {
            best = key;
            bestWeight = weight;
        }
    }
    return best;
}

/** "Adamant:2/32/0/0/0/32" → nature and stat points. */
function parseSpread(spread: string): { nature: string; statPoints: StatTable } | null {
    const [nature, points] = spread.split(":");
    const values = (points ?? "").split("/").map(Number);
    if (!nature || values.length !== 6 || values.some((v) => !Number.isFinite(v))) return null;
    const statPoints = {} as StatTable;
    STAT_IDS.forEach((stat, index) => {
        statPoints[stat] = values[index];
    });
    return { nature, statPoints };
}

function describeSpread(nature: string, statPoints: StatTable): string {
    const spent = STAT_IDS.filter((stat) => statPoints[stat] > 0)
        .map((stat) => `${statPoints[stat]} ${STAT_LABELS[stat]}`)
        .join(" / ");
    return `${nature}${spent ? `, ${spent}` : ", no stat points"}`;
}

// The calculator's "Aegislash-Both" is reported under the name the caller and
// the usage tools use.
const DISPLAY_NAMES: Record<string, string> = { aegislashboth: "Aegislash" };

interface FoundSpecies {
    /** The calculator's own name for the species. */
    calcName: string;
    /** The name to show: one the other tools accept. */
    name: string;
    id: string;
}

function findSpecies(gen: Calc, input: string): Resolved<FoundSpecies> {
    const tryId = (id: string): FoundSpecies | null => {
        const species = gen.species.get(SPECIES_ALIASES[id] ?? id);
        if (!species) return null;
        return {
            calcName: species.name,
            name: DISPLAY_NAMES[species.id] ?? species.name,
            id: species.id,
        };
    };
    const direct = tryId(toId(input));
    if (direct) return { ok: true, value: direct };

    // Fall back to this connector's own name handling (spelling variants).
    const resolved = resolvePokemon(input);
    const viaDex = resolved ? tryId(toId(resolved.name)) : null;
    if (viaDex) return { ok: true, value: viaDex };

    // A real Pokémon that is not in Pokémon Champions is not a spelling mistake.
    return {
        ok: false,
        error: resolved
            ? `${resolved.name} is not in Pokémon Champions' battle data, so it cannot be used in a calculation.`
            : pokemonNotFound(input),
    };
}

async function loadTypical(
    name: string,
    regulation: RegulationSet,
    env: Env,
): Promise<TypicalSet | null> {
    if (!regulation.showdownFormatId || !env?.POKEMON_STATS) return null;
    const key = `${regulation.showdownFormatId}:${toId(name)}`;
    const cached = typicalSets.get(key);
    if (cached) return cached;
    const usage = await getPokemonStats(name, regulation.showdownFormatId, env);
    if (!usage) return null;
    const typical = summarize(usage);
    typicalSets.set(key, typical);
    return typical;
}

async function resolveSet(
    gen: Calc,
    calc: Calc,
    input: SetInput,
    regulation: RegulationSet,
    env: Env,
    options: { abilityActive?: boolean } = {},
): Promise<Resolved<ResolvedSet>> {
    const found = findSpecies(gen, input.pokemon);
    if (found.ok === false) return { ok: false, error: found.error };
    const species = found.value;

    const assumptions: string[] = [];
    const needsUsage =
        (input.nature === undefined && input.statPoints === undefined) ||
        input.ability === undefined ||
        input.item === undefined;
    const typical = needsUsage ? await loadTypical(input.pokemon, regulation, env) : null;
    const from = `most common in ${regulation.shortLabel} usage`;

    // Nature and stat points travel together: a spread only makes sense whole.
    let nature = "Hardy";
    const statPoints = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } as StatTable;
    if (input.nature === undefined && input.statPoints === undefined) {
        const spread = typical?.spread ?? null;
        if (spread) {
            nature = spread.nature;
            Object.assign(statPoints, spread.statPoints);
            assumptions.push(
                `${species.name}: ${describeSpread(nature, statPoints)} (${from}; no spread was given)`,
            );
        } else {
            assumptions.push(
                `${species.name}: neutral nature and no stat points (no spread was given and no usage data is available)`,
            );
        }
    } else {
        if (input.nature !== undefined) {
            const known = gen.natures.get(toId(input.nature));
            if (!known) {
                return {
                    ok: false,
                    error: `"${input.nature}" is not a nature. Use one such as Adamant, Jolly, Modest, Timid, Bold or Calm.`,
                };
            }
            nature = known.name;
        } else {
            assumptions.push(`${species.name}: neutral nature (none was given)`);
        }
        for (const stat of STAT_IDS) statPoints[stat] = input.statPoints?.[stat] ?? 0;
        if (input.statPoints === undefined) {
            assumptions.push(`${species.name}: no stat points (none were given)`);
        }
    }
    const total = STAT_IDS.reduce((sum, stat) => sum + statPoints[stat], 0);
    if (total > MAX_STAT_POINTS_TOTAL) {
        return {
            ok: false,
            error:
                `${species.name}'s stat points add up to ${total}. A Pokémon has ` +
                `${MAX_STAT_POINTS_TOTAL} to spend, with at most ${MAX_STAT_POINTS_PER_STAT} on one stat.`,
        };
    }

    let ability: string;
    if (input.ability !== undefined) {
        const known = gen.abilities.get(toId(input.ability));
        if (!known) return { ok: false, error: `"${input.ability}" is not a known ability.` };
        ability = known.name;
    } else {
        const common = gen.abilities.get(typical?.ability ?? "");
        const fallback = gen.species.get(species.id)?.abilities?.[0];
        ability = common?.name ?? fallback ?? "";
        if (ability) {
            assumptions.push(
                `${species.name}: ${ability} (${common ? from : "its first ability"}; no ability was given)`,
            );
        }
    }

    let item: string | null = null;
    if (input.item !== undefined) {
        if (!["", "none", "noitem", "nothing"].includes(toId(input.item))) {
            const known = gen.items.get(toId(input.item));
            if (!known) return { ok: false, error: `"${input.item}" is not a known item.` };
            item = known.name;
        }
    } else {
        const common = gen.items.get(typical?.item ?? "");
        item = common?.name ?? null;
        assumptions.push(
            item
                ? `${species.name}: ${item} (${from}; no item was given)`
                : `${species.name}: no item (none was given)`,
        );
    }

    // The calculator does not Mega Evolve a Pokémon because it holds the stone.
    const megaForm = item ? calc.MEGA_STONES?.[item]?.[species.calcName] : undefined;
    if (megaForm) {
        assumptions.push(
            `${species.name}: calculated before Mega Evolution; name ${megaForm} to calculate it Mega Evolved`,
        );
    }

    const boosts: Record<string, number> = {};
    for (const [stat, stage] of Object.entries(input.boosts ?? {})) {
        if (stage) boosts[stat] = stage;
    }

    const pokemon = new calc.Pokemon(gen, species.calcName, {
        level: 50,
        nature,
        evs: statPoints, // In Champions mode the library reads these as stat points.
        ability: ability || undefined,
        abilityOn: options.abilityActive || undefined,
        item: item ?? undefined,
        boosts,
        status: input.status ? STATUS_CODES[input.status] : undefined,
    });

    const stats = {} as StatTable;
    for (const stat of STAT_IDS) stats[stat] = pokemon.rawStats[stat];

    return {
        ok: true,
        value: {
            pokemon,
            assumptions,
            typical,
            echo: {
                pokemon: species.name,
                nature,
                statPoints,
                ability,
                item,
                stats,
                ...(Object.keys(boosts).length ? { boosts } : {}),
                ...(input.status ? { status: input.status } : {}),
            },
        },
    };
}

function buildField(calc: Calc, field: FieldInput = {}): Calc {
    return new calc.Field({
        gameType: "Doubles",
        weather: field.weather ? WEATHER[field.weather] : undefined,
        terrain: field.terrain ? TERRAIN[field.terrain] : undefined,
        attackerSide: new calc.Side({ isHelpingHand: !!field.helpingHand }),
        defenderSide: new calc.Side({
            isReflect: !!field.reflect,
            isLightScreen: !!field.lightScreen,
            isAuroraVeil: !!field.auroraVeil,
            isFriendGuard: !!field.friendGuard,
        }),
    });
}

function fieldNotes(field: FieldInput = {}): string[] {
    const notes: string[] = [];
    if (field.weather) notes.push(`${WEATHER[field.weather]} weather`);
    if (field.terrain) notes.push(`${TERRAIN[field.terrain]} Terrain`);
    if (field.reflect) notes.push("Reflect");
    if (field.lightScreen) notes.push("Light Screen");
    if (field.auroraVeil) notes.push("Aurora Veil");
    if (field.helpingHand) notes.push("Helping Hand");
    if (field.friendGuard) notes.push("Friend Guard");
    if (field.criticalHit) notes.push("critical hit");
    return notes;
}

// --- One damage calculation ---

interface DamageResult {
    move: { name: string; type: string; category: string; basePower: number };
    spread: boolean;
    min: number;
    max: number;
    minPercent: number;
    maxPercent: number;
    defenderHp: number;
    knockOut?: { hits: number | null; chancePercent: number | null; text: string };
    noDamageReason?: string;
    description: string;
}

const SPREAD_TARGETS = ["allAdjacent", "allAdjacentFoes"];

function runDamage(
    gen: Calc,
    calc: Calc,
    attacker: CalcPokemon,
    defender: CalcPokemon,
    moveName: string,
    field: FieldInput,
): Resolved<DamageResult> {
    const known = gen.moves.get(toId(moveName));
    if (!known) {
        return {
            ok: false,
            error: `"${moveName}" is not a move in Pokémon Champions. Check the spelling.`,
        };
    }

    const isSpreadMove = SPREAD_TARGETS.includes(known.target);
    const move = new calc.Move(gen, known.name, {
        isCrit: !!field.criticalHit,
        // A spread move with one target left does full damage.
        overrides: isSpreadMove && field.singleTarget ? { target: "normal" } : undefined,
    });
    const result = calc.calculate(gen, attacker, defender, move, buildField(calc, field));
    const [min, max] = result.range() as [number, number];
    const defenderHp = defender.maxHP() as number;
    const base = {
        move: {
            name: move.name as string,
            type: move.type as string,
            category: move.category as string,
            basePower: (move.bp as number) ?? 0,
        },
        spread: isSpreadMove && !field.singleTarget,
        min,
        max,
        minPercent: round2((min / defenderHp) * 100),
        maxPercent: round2((max / defenderHp) * 100),
        defenderHp,
    };

    if (max === 0) {
        let noDamageReason: string;
        if (move.category === "Status") {
            noDamageReason = `${move.name} is a status move and deals no damage.`;
        } else {
            const chart = gen.types.get(toId(move.type))?.effectiveness ?? {};
            const immune = (defender.types as string[]).some((type) => chart[type] === 0);
            noDamageReason = immune
                ? `${defender.name} is immune to ${move.type}-type moves.`
                : `${move.name} deals no damage here, or its damage does not follow the standard formula and cannot be calculated.`;
        }
        return {
            ok: true,
            value: {
                ...base,
                noDamageReason,
                description: `${attacker.name} ${move.name} vs. ${defender.name}: no damage`,
            },
        };
    }

    // The library derives these from the damage rolls and throws when there are none.
    const ko = result.kochance();
    return {
        ok: true,
        value: {
            ...base,
            knockOut: {
                hits: ko.n > 0 ? ko.n : null,
                chancePercent: typeof ko.chance === "number" ? round2(ko.chance * 100) : null,
                text: ko.text || "not a knock-out within 9 hits",
            },
            description: result.desc() as string,
        },
    };
}

const SPREAD_ASSUMPTION =
    "spread move hitting both opponents (75% damage); set singleTarget when one target is left";

// --- calculate_damage ---

export async function calculateDamage(
    args: {
        attacker: SetInput;
        defender: SetInput;
        move: string;
        format?: string;
        field?: FieldInput;
    },
    env: Env,
): Promise<ToolOutcome> {
    const { calc } = await loadCalc();
    const gen = calc.Generations.get(0);
    const regulation = resolveRegulation(args.format);
    const field = args.field ?? {};

    const [attacker, defender] = await Promise.all([
        resolveSet(gen, calc, args.attacker, regulation, env),
        resolveSet(gen, calc, args.defender, regulation, env),
    ]);
    if (attacker.ok === false) return fail(attacker.error);
    if (defender.ok === false) return fail(defender.error);

    const damage = runDamage(
        gen,
        calc,
        attacker.value.pokemon,
        defender.value.pokemon,
        args.move,
        field,
    );
    if (damage.ok === false) return fail(damage.error);
    const result = damage.value;

    const assumptions = [
        "level 50, doubles battle",
        ...(result.spread ? [SPREAD_ASSUMPTION] : []),
        ...attacker.value.assumptions,
        ...defender.value.assumptions,
    ];
    const conditions = fieldNotes(field);

    const lines = [
        `**${result.description}**`,
        "",
        result.noDamageReason
            ? result.noDamageReason
            : `Damage: ${result.min}–${result.max} of ${result.defenderHp} HP ` +
              `(${result.minPercent}–${result.maxPercent}%). ${capitalize(result.knockOut?.text ?? "")}.`,
        "",
        `Attacker: ${setLine(attacker.value.echo)}`,
        `Defender: ${setLine(defender.value.echo)}`,
        ...(conditions.length ? [`Conditions: ${conditions.join(", ")}`] : []),
        "",
        "Assumed:",
        ...assumptions.map((line) => `- ${line}`),
        "",
        "One calculation under these conditions, not a battle simulation.",
    ];

    return ok(
        {
            ...formatFields(regulation),
            attacker: attacker.value.echo,
            defender: defender.value.echo,
            move: result.move,
            damage: {
                min: result.min,
                max: result.max,
                minPercent: result.minPercent,
                maxPercent: result.maxPercent,
                defenderHp: result.defenderHp,
            },
            ...(result.knockOut ? { knockOut: result.knockOut } : {}),
            ...(result.noDamageReason ? { noDamageReason: result.noDamageReason } : {}),
            description: result.description,
            conditions,
            assumptions,
        },
        lines.join("\n"),
    );
}

function capitalize(text: string): string {
    return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function setLine(set: SetEcho): string {
    const boosts = Object.entries(set.boosts ?? {})
        .map(([stat, stage]) => `${stage > 0 ? "+" : ""}${stage} ${STAT_LABELS[stat as StatId]}`)
        .join(", ");
    return [
        `${set.pokemon} — ${describeSpread(set.nature, set.statPoints)}`,
        set.ability,
        set.item ?? "no item",
        ...(boosts ? [boosts] : []),
        ...(set.status ? [set.status] : []),
    ]
        .filter(Boolean)
        .join("; ");
}

// --- compare_speed ---

type SpeedEntry = SetInput & { tailwind?: boolean; abilityActive?: boolean };

export async function compareSpeed(
    args: {
        pokemon: SpeedEntry[];
        format?: string;
        weather?: keyof typeof WEATHER;
        terrain?: keyof typeof TERRAIN;
        trickRoom?: boolean;
    },
    env: Env,
): Promise<ToolOutcome> {
    const { calc, getFinalSpeed } = await loadCalc();
    const gen = calc.Generations.get(0);
    const regulation = resolveRegulation(args.format);
    const field = buildField(calc, { weather: args.weather, terrain: args.terrain });

    const resolved = await Promise.all(
        args.pokemon.map((entry) =>
            resolveSet(gen, calc, entry, regulation, env, { abilityActive: entry.abilityActive }),
        ),
    );
    const failed = resolved.find((entry) => entry.ok === false);
    if (failed && failed.ok === false) return fail(failed.error);

    const assumptions = ["level 50"];
    const entries = resolved.map((entry, index) => {
        const {
            pokemon,
            echo,
            assumptions: filled,
        } = (entry as { ok: true; value: ResolvedSet }).value;
        const input = args.pokemon[index];
        assumptions.push(...filled);
        const side = new calc.Side({ isTailwind: !!input.tailwind });
        const speed = getFinalSpeed(gen, pokemon, field, side) as number;
        const conditions = [
            ...(input.tailwind ? ["Tailwind"] : []),
            ...(echo.boosts?.spe
                ? [`${echo.boosts.spe > 0 ? "+" : ""}${echo.boosts.spe} Speed`]
                : []),
            ...(input.status === "paralysis" ? ["paralysis"] : []),
            ...(input.abilityActive ? [`${echo.ability} active`] : []),
        ];
        return {
            pokemon: echo.pokemon,
            speed,
            speedStat: echo.stats.spe,
            nature: echo.nature,
            speedStatPoints: echo.statPoints.spe,
            ability: echo.ability,
            item: echo.item,
            conditions,
        };
    });

    // Under Trick Room the slower Pokémon moves first.
    const order = [...entries].sort((a, b) =>
        args.trickRoom ? a.speed - b.speed : b.speed - a.speed,
    );
    const ties: string[][] = [];
    for (const speed of new Set(order.map((entry) => entry.speed))) {
        const tied = order.filter((entry) => entry.speed === speed);
        if (tied.length > 1) ties.push(tied.map((entry) => entry.pokemon));
    }

    const conditions = [
        ...(args.weather ? [`${WEATHER[args.weather]} weather`] : []),
        ...(args.terrain ? [`${TERRAIN[args.terrain]} Terrain`] : []),
        ...(args.trickRoom ? ["Trick Room"] : []),
    ];
    const lines = [
        `**Speed order${args.trickRoom ? " under Trick Room (slowest moves first)" : ""}**`,
        "",
        ...order.map((entry, index) => {
            const detail = [
                `${entry.nature}, ${entry.speedStatPoints} Spe`,
                ...(entry.speed !== entry.speedStat ? [`stat ${entry.speedStat}`] : []),
                ...(entry.item ? [entry.item] : []),
                ...entry.conditions,
            ].join("; ");
            return `${index + 1}. ${entry.pokemon} — ${entry.speed} (${detail})`;
        }),
        ...(ties.length
            ? ["", ...ties.map((group) => `Speed tie: ${group.join(", ")} (decided at random).`)]
            : []),
        ...(conditions.length ? ["", `Conditions: ${conditions.join(", ")}`] : []),
        "",
        "Assumed:",
        ...assumptions.map((line) => `- ${line}`),
        "",
        "Speed decides order only among moves of the same priority.",
    ];

    return ok(
        {
            ...formatFields(regulation),
            trickRoom: !!args.trickRoom,
            order,
            ties,
            conditions,
            assumptions,
        },
        lines.join("\n"),
    );
}

// --- check_team_threats ---

type TeamMember = SetInput & { moves?: string[] };

interface Hit {
    attacker: string;
    defender: string;
    move: string;
    minPercent: number;
    maxPercent: number;
    knockOut: string;
    /** Weather or terrain the attacker's own ability sets, when it was applied. */
    conditions?: string;
}

/** A Pokémon's damaging moves, most used first. */
function commonAttacks(gen: Calc, typical: TypicalSet | null, limit: number): string[] {
    return (typical?.moves ?? [])
        .map((id) => gen.moves.get(id))
        .filter((move) => move && move.category !== "Status" && (move.basePower ?? 0) > 0)
        .slice(0, limit)
        .map((move) => move.name as string);
}

// Abilities that set weather or terrain when the Pokémon enters. A threat
// check with a plain field would understate exactly the Pokémon built around
// these (Charizard-Mega-Y in sun, Rillaboom in Grassy Terrain), so each
// Pokémon's own attacks are calculated under what its ability sets.
const ENTRY_FIELD: Record<string, FieldInput> = {
    drought: { weather: "sun" },
    drizzle: { weather: "rain" },
    sandstream: { weather: "sand" },
    snowwarning: { weather: "snow" },
    grassysurge: { terrain: "grassy" },
    electricsurge: { terrain: "electric" },
    psychicsurge: { terrain: "psychic" },
    mistysurge: { terrain: "misty" },
};

interface Fighter {
    pokemon: CalcPokemon;
    /** Display name. */
    name: string;
    moves: string[];
    /** What this Pokémon's ability sets on entry. */
    ownField: FieldInput;
}

function fighter(set: ResolvedSet, moves: string[]): Fighter {
    return {
        pokemon: set.pokemon,
        name: set.echo.pokemon,
        moves,
        ownField: ENTRY_FIELD[toId(set.echo.ability)] ?? {},
    };
}

function bestHit(gen: Calc, calc: Calc, attackers: Fighter[], defenders: Fighter[]): Hit | null {
    let best: Hit | null = null;
    for (const attacker of attackers) {
        const conditions = fieldNotes(attacker.ownField).join(", ");
        for (const move of attacker.moves) {
            for (const defender of defenders) {
                let damage: Resolved<DamageResult>;
                try {
                    damage = runDamage(
                        gen,
                        calc,
                        attacker.pokemon,
                        defender.pokemon,
                        move,
                        attacker.ownField,
                    );
                } catch {
                    continue; // One move the library cannot handle must not sink the report.
                }
                if (damage.ok === false || damage.value.max === 0) continue;
                if (!best || damage.value.maxPercent > best.maxPercent) {
                    best = {
                        attacker: attacker.name,
                        defender: defender.name,
                        move: damage.value.move.name,
                        minPercent: damage.value.minPercent,
                        maxPercent: damage.value.maxPercent,
                        knockOut: damage.value.knockOut?.text ?? "",
                        ...(conditions ? { conditions } : {}),
                    };
                }
            }
        }
    }
    return best;
}

export const MAX_THREATS = 10;

export async function checkTeamThreats(
    args: { team: TeamMember[]; format?: string; threats?: string[]; limit?: number },
    env: Env,
): Promise<ToolOutcome> {
    const { calc, getFinalSpeed } = await loadCalc();
    const gen = calc.Generations.get(0);
    const regulation = resolveRegulation(args.format);
    const field = buildField(calc);
    const side = new calc.Side({});
    const assumptions = [
        "level 50, doubles battle, no screens or stat changes",
        "a Pokémon whose ability sets weather or terrain attacks under it; otherwise none",
        "spread moves hit both opponents (75% damage), as usual in doubles",
    ];

    // The team.
    const team: (Fighter & { speed: number })[] = [];
    for (const member of args.team) {
        const set = await resolveSet(gen, calc, member, regulation, env);
        if (set.ok === false) return fail(set.error);
        assumptions.push(...set.value.assumptions);
        const name = set.value.echo.pokemon;

        let moves: string[];
        if (member.moves?.length) {
            moves = [];
            for (const moveName of member.moves) {
                const known = gen.moves.get(toId(moveName));
                if (!known) {
                    return fail(
                        `"${moveName}" is not a move in Pokémon Champions. Check the spelling.`,
                    );
                }
                moves.push(known.name);
            }
        } else {
            const typical =
                set.value.typical ?? (await loadTypical(member.pokemon, regulation, env));
            moves = commonAttacks(gen, typical, 4);
            if (!moves.length) {
                return fail(
                    `No moves were given for ${name} and it has no usage data in ` +
                        `${regulation.shortLabel} to take them from. Pass its moves.`,
                );
            }
            assumptions.push(
                `${name}: ${moves.join(", ")} (its most used attacks; no moves were given)`,
            );
        }
        team.push({
            ...fighter(set.value, moves),
            speed: getFinalSpeed(gen, set.value.pokemon, field, side) as number,
        });
    }

    // The threats: named by the caller, or the most used Pokémon in the format.
    let threatNames: string[];
    const usagePercent = new Map<string, number>();
    const index = regulation.showdownFormatId
        ? await getFormatIndex(regulation.showdownFormatId, env)
        : null;
    for (const [name, usage] of Object.entries(index?.pokemon ?? {})) {
        usagePercent.set(toId(name), round2(usage * 100));
    }
    if (args.threats?.length) {
        threatNames = args.threats;
    } else {
        if (!index) {
            return fail(
                `Usage statistics for ${regulation.shortLabel} are unavailable, so the most used ` +
                    "Pokémon cannot be listed. Pass the threats to check, or try again later.",
            );
        }
        threatNames = Object.entries(index.pokemon)
            .sort(([, a], [, b]) => b - a)
            .slice(0, Math.min(args.limit ?? 8, MAX_THREATS))
            .map(([name]) => name);
    }

    const threatSets = await Promise.all(
        threatNames.map(async (name) => {
            const set = await resolveSet(gen, calc, { pokemon: name }, regulation, env);
            if (set.ok === false) return set;
            // A threat named with every field of its set left out reads usage
            // data above; this covers the case where none exists.
            const typical = set.value.typical ?? (await loadTypical(name, regulation, env));
            return { ok: true as const, value: { ...set.value, typical } };
        }),
    );
    const threats = [];
    for (const [position, set] of threatSets.entries()) {
        if (set.ok === false) return fail(set.error);
        const { pokemon, echo, typical } = set.value;
        const moves = commonAttacks(gen, typical, 4);
        const speed = getFinalSpeed(gen, pokemon, field, side) as number;
        const self = fighter(set.value, moves);
        threats.push({
            pokemon: echo.pokemon,
            usagePercent: usagePercent.get(toId(threatNames[position])) ?? null,
            set: describeSpread(echo.nature, echo.statPoints),
            ability: echo.ability,
            item: echo.item,
            speed,
            moves,
            fasterTeamMembers: team.filter((m) => m.speed > speed).map((m) => m.name),
            tiedTeamMembers: team.filter((m) => m.speed === speed).map((m) => m.name),
            bestAnswer: bestHit(gen, calc, team, [self]),
            biggestRisk: bestHit(gen, calc, [self], team),
            hasUsageData: !!typical,
        });
    }
    assumptions.push(
        `each threat uses its most common spread, ability, item and attacks in ${regulation.shortLabel} usage`,
    );

    const hitText = (hit: Hit | null, who: (hit: Hit) => string) =>
        hit
            ? `${who(hit)} ${hit.move} ${hit.minPercent}–${hit.maxPercent}%` +
              (hit.knockOut ? ` (${hit.knockOut})` : "") +
              (hit.conditions ? ` in ${hit.conditions}` : "")
            : "no damaging option";
    const lines = [
        `**Threat check — ${regulation.shortLabel}**`,
        "",
        `Team speeds: ${team.map((m) => `${m.name} ${m.speed}`).join(", ")}`,
        "",
        ...threats.flatMap((threat) => [
            `**${threat.pokemon}**${threat.usagePercent !== null ? ` (${threat.usagePercent}% usage)` : ""} — ` +
                `speed ${threat.speed}; ${threat.set}; ${threat.ability || "no ability data"}; ${threat.item ?? "no item"}`,
            `- Your best hit: ${hitText(threat.bestAnswer, (hit) => hit.attacker)}`,
            `- Its best hit: ${hitText(threat.biggestRisk, (hit) => `into ${hit.defender},`)}`,
            `- Faster than it: ${threat.fasterTeamMembers.join(", ") || "nobody"}` +
                (threat.tiedTeamMembers.length
                    ? `; speed tie: ${threat.tiedTeamMembers.join(", ")}`
                    : ""),
            ...(threat.hasUsageData
                ? []
                : ["- No usage data for this Pokémon, so its set is a plain default."]),
            "",
        ]),
        "Assumed:",
        ...assumptions.map((line) => `- ${line}`),
        "",
        "Single hits under plain conditions, not a battle simulation. Use calculate_damage for a specific set or field.",
    ];

    return ok(
        {
            ...formatFields(regulation),
            team: team.map((member) => ({
                pokemon: member.name,
                speed: member.speed,
                moves: member.moves,
            })),
            threats: threats.map(({ hasUsageData, ...threat }) => threat),
            assumptions,
        },
        lines.join("\n"),
    );
}
