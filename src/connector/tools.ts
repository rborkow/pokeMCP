/**
 * The public "VGC Teambuilder" connector surface: every tool a directory
 * listing exposes, with the metadata reviewers and clients read.
 *
 * Changing a tool here changes the published connector: keep each description
 * accurate about what the tool does and does not check, and regenerate the docs
 * (`bun run generate-tool-docs`).
 */
import { z } from "zod";
import { formatInput, formatOutput, getDefaultRegulation } from "./formats.js";
import { analyzeTeamTypes, lookupPokemon, validateMoveset } from "./pokemon.js";
import {
    calculateDamage,
    checkTeamThreats,
    compareSpeed,
    MAX_STAT_POINTS_PER_STAT,
    MAX_STAT_POINTS_TOTAL,
    MAX_THREATS,
} from "./matchup.js";
import { listFormats, validateTeam } from "./team.js";
import { getMetaShifts, getUsageMomentum, getUsageTrend } from "./trends.js";
import type { ConnectorTool } from "./types.js";
import { getChecksAndCounters, getPokemonUsage, getTeammates, getTopUsage } from "./usage.js";

export const CONNECTOR_INFO = {
    name: "vgc-teambuilder",
    title: "VGC Teambuilder",
    version: "1.0.0",
    websiteUrl: "https://www.pokemcp.com",
};

export const CONNECTOR_INSTRUCTIONS =
    "VGC Teambuilder provides read-only data tools for building competitive Pokémon doubles " +
    "(VGC) teams under Pokémon Champions regulations: Pokémon data, move and team legality " +
    "checks, defensive type analysis, usage statistics and trends, and matchup calculations " +
    "(damage, Speed order, and a team checked against the most used Pokémon). Use the " +
    "calculation tools instead of estimating numbers, and tell the user what a result assumed. " +
    "They are single calculations, not battle simulations. Usage figures come from " +
    "Pokémon Showdown ladder data that Smogon publishes monthly; percentages are shares of " +
    "teams or sets, not win rates. Formats are regulation ids from list_formats; when a tool's " +
    `format is omitted it uses ${getDefaultRegulation().id}. Use English Pokémon names, with ` +
    "alternate forms hyphenated (Landorus-Therian, Charizard-Mega-Y). This is an unofficial " +
    "fan project, not affiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK inc. " +
    "or The Pokémon Company.";

// --- Shared schema pieces ---

const pokemonInput = z
    .string()
    .min(1)
    .max(60)
    .describe('Pokémon name in English, e.g. "Incineroar" or "Landorus-Therian"');

const statsPokemonInput = z
    .string()
    .min(1)
    .max(60)
    .describe(
        'Pokémon name in English. Mega Evolutions are tracked separately, e.g. "Charizard-Mega-Y"',
    );

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");

const rangeInput = {
    from: month
        .optional()
        .describe("First month, YYYY-MM. The nearest month with data is used if it has none"),
    to: month.optional().describe("Last month, YYYY-MM. Defaults to the most recent month"),
};

const monthsInput = (fallback: number) =>
    z
        .number()
        .int()
        .min(1)
        .max(36)
        .optional()
        .describe(
            `Months to look back from \`to\` when \`from\` is omitted. Defaults to ${fallback}`,
        );

const limitInput = (fallback: number, max: number) =>
    z
        .number()
        .int()
        .min(1)
        .max(max)
        .optional()
        .describe(`Maximum entries to return (1–${max}). Defaults to ${fallback}`);

const baseStats = z.object({
    hp: z.number(),
    atk: z.number(),
    def: z.number(),
    spa: z.number(),
    spd: z.number(),
    spe: z.number(),
    total: z.number(),
});

const share = z.object({
    name: z.string(),
    percent: z.number().describe("Share of this Pokémon's recorded sets, 0–100"),
});

const rangeOutput = {
    from: z.string().describe("First month compared, YYYY-MM"),
    to: z.string().describe("Last month compared, YYYY-MM"),
};

const mover = z.object({
    name: z.string(),
    changePoints: z.number().describe("Change in usage, in percentage points"),
    fromPercent: z.number(),
    toPercent: z.number(),
    rank: z.number().describe("Usage rank in the last month"),
});

const momentumEntry = z.object({
    name: z.string(),
    slopePointsPerMonth: z
        .number()
        .describe("Fitted change in usage per month, in percentage points"),
    usagePercent: z.number().describe("Usage in the last month, 0–100"),
    accelerating: z
        .boolean()
        .describe("True if the rise or decline is steeper in the later half of the range"),
});

// --- Tools ---

// --- Matchup tool pieces ---

const statPoint = z.number().int().min(0).max(MAX_STAT_POINTS_PER_STAT).optional();
const statPointsInput = z
    .object({
        hp: statPoint,
        atk: statPoint,
        def: statPoint,
        spa: statPoint,
        spd: statPoint,
        spe: statPoint,
    })
    .strict()
    .describe(
        `Pokémon Champions stat points per stat (0–${MAX_STAT_POINTS_PER_STAT} each, ` +
            `${MAX_STAT_POINTS_TOTAL} in total). Stats left out get 0.`,
    );
const stage = z.number().int().min(-6).max(6).optional();
const boostsInput = z
    .object({ atk: stage, def: stage, spa: stage, spd: stage, spe: stage })
    .strict()
    .describe("Stat stages from moves and abilities, -6 to +6. For example { atk: 2 }.");

/** One Pokémon's set. Everything but the name is optional. */
const setFields = {
    pokemon: statsPokemonInput,
    nature: z
        .string()
        .max(20)
        .optional()
        .describe(
            "Nature, such as Adamant or Timid. If nature and statPoints are both left out, " +
                "the Pokémon's most common spread in the regulation's usage statistics is used.",
        ),
    statPoints: statPointsInput.optional(),
    ability: z
        .string()
        .max(40)
        .optional()
        .describe("Ability. Defaults to the Pokémon's most used ability in the regulation."),
    item: z
        .string()
        .max(40)
        .optional()
        .describe(
            'Held item, or "none". Defaults to the Pokémon\'s most used item in the regulation.',
        ),
    boosts: boostsInput.optional(),
    status: z
        .enum(["burn", "paralysis"])
        .optional()
        .describe("Burn halves physical damage dealt; paralysis halves Speed."),
};
const setInput = z.object(setFields).strict();

const weatherInput = z.enum(["sun", "rain", "sand", "snow"]).optional();
const terrainInput = z.enum(["electric", "grassy", "misty", "psychic"]).optional();

const statTable = z.object({
    hp: z.number(),
    atk: z.number(),
    def: z.number(),
    spa: z.number(),
    spd: z.number(),
    spe: z.number(),
});
const setOutput = z.object({
    pokemon: z.string(),
    nature: z.string(),
    statPoints: statTable.describe("Stat points used"),
    ability: z.string(),
    item: z.string().nullable(),
    stats: statTable.describe("Resulting stats at level 50, before stat stages"),
    boosts: z.record(z.string(), z.number()).optional(),
    status: z.string().optional(),
});
const assumptionsOutput = z
    .array(z.string())
    .describe(
        "Everything the calculation assumed, including any part of a set that was filled in " +
            "because it was not given. Tell the user about these.",
    );
const hitOutput = z
    .object({
        attacker: z.string(),
        defender: z.string(),
        move: z.string(),
        minPercent: z.number().describe("Lowest damage roll as % of the defender's HP"),
        maxPercent: z.number().describe("Highest damage roll as % of the defender's HP"),
        knockOut: z.string().describe('For example "guaranteed 2HKO"'),
        conditions: z
            .string()
            .optional()
            .describe("Weather or terrain set by the attacker's own ability, when applied"),
    })
    .nullable();

export const CONNECTOR_TOOLS: ConnectorTool[] = [
    {
        name: "list_formats",
        title: "List supported formats",
        description:
            "List the Pokémon Champions regulations this connector supports, with each one's id, " +
            "dates, whether it is current, team rules, number of legal Mega Evolutions and whether usage statistics are " +
            "available. Use it to find the `format` value other tools accept and to see which " +
            "format they use by default.",
        inputSchema: {},
        outputSchema: {
            defaultFormat: z.string().describe("Format used when a tool's `format` is omitted"),
            formats: z.array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    status: z
                        .enum(["upcoming", "current", "ended"])
                        .describe("Where today falls relative to the regulation's dates"),
                    startDate: z.string().describe("YYYY-MM-DD"),
                    endDate: z.string().optional().describe("YYYY-MM-DD, when announced"),
                    level: z.number(),
                    teamSize: z.number(),
                    bringCount: z.number().describe("Pokémon brought to each battle"),
                    speciesClause: z.boolean(),
                    itemClause: z.boolean(),
                    megaEvolutions: z.number().describe("Number of legal Mega Evolutions"),
                    usageStats: z
                        .boolean()
                        .describe(
                            "Whether usage statistics are published for the regulation. Does " +
                                "not guarantee the latest month is loaded",
                        ),
                }),
            ),
        },
        run: () => listFormats(),
    },
    {
        name: "lookup_pokemon",
        title: "Look up a Pokémon",
        description:
            "Get a Pokémon's types, base stats, abilities, weight, alternate forms and any Mega " +
            "Evolutions legal in the supported regulations (with the Mega's types, ability and " +
            "base stats). Data comes from Pokémon Showdown; it does not say whether the Pokémon " +
            "itself is legal in a format — use validate_team for that.",
        inputSchema: { pokemon: pokemonInput },
        outputSchema: {
            name: z.string(),
            dexNumber: z.number(),
            types: z.array(z.string()),
            baseStats,
            abilities: z.array(z.object({ name: z.string(), hidden: z.boolean() })),
            weightKg: z.number().optional(),
            baseSpecies: z.string().optional().describe("Set when this is an alternate form"),
            otherForms: z.array(z.string()),
            megaEvolutions: z.array(
                z.object({
                    name: z.string(),
                    megaStone: z.string(),
                    types: z.array(z.string()).optional(),
                    ability: z.string().optional(),
                    baseStats: baseStats.optional(),
                    formats: z.array(z.string()).describe("Regulation ids where it is legal"),
                }),
            ),
        },
        run: (args) => lookupPokemon(args),
    },
    {
        name: "validate_moveset",
        title: "Check which moves a Pokémon can learn",
        description:
            "Check whether a Pokémon can learn each of the given moves in any Pokémon game, " +
            "counting moves inherited from its pre-evolutions and base form. Based on Pokémon " +
            "Showdown learnset data across all generations, not Pokémon Champions' own move " +
            "lists: a move learnable only in an older game may not exist in Champions, and a " +
            "move added only in Champions may be reported as not learnable.",
        inputSchema: {
            pokemon: pokemonInput,
            moves: z
                .array(z.string().min(1).max(60))
                .min(1)
                .max(12)
                .describe("Move names to check"),
        },
        outputSchema: {
            pokemon: z.string(),
            allLearnable: z.boolean(),
            moves: z.array(
                z.object({
                    move: z.string(),
                    learnable: z.boolean().describe("Learnable in at least one Pokémon game"),
                    detail: z.string().describe("How the move is learned, or why it is not"),
                }),
            ),
        },
        run: (args) => validateMoveset(args),
    },
    {
        name: "validate_team",
        title: "Validate a team for a regulation",
        description:
            "Check a team against a Pokémon Champions regulation: each Pokémon is on the " +
            "regulation's allowed list, Species Clause, Item Clause, at most four moves each, " +
            "moves are learnable and abilities belong to the Pokémon. A Mega Evolution named " +
            'directly (e.g. "Charizard-Mega-Y") is checked as its base Pokémon holding its Mega ' +
            "Stone. It does not check stat spreads or held-item availability. Move data comes " +
            "from Pokémon Showdown across all generations, not Pokémon Champions' own move " +
            "lists, so a move from an older game can pass and a Champions-only move can fail.",
        inputSchema: {
            team: z
                .array(
                    z.object({
                        pokemon: pokemonInput,
                        moves: z.array(z.string().min(1).max(60)).max(8).optional(),
                        ability: z.string().max(60).optional(),
                        item: z.string().max(60).optional(),
                    }),
                )
                .min(1)
                .max(10)
                .describe("Team members. Only `pokemon` is required for each"),
            format: formatInput,
        },
        outputSchema: {
            ...formatOutput,
            valid: z.boolean().describe("True when there are no errors"),
            errors: z.array(z.string()),
            warnings: z.array(z.string()).describe("Cautions that do not make the team invalid"),
            members: z.array(
                z.object({
                    pokemon: z.string(),
                    status: z.enum(["allowed", "not_allowed", "unknown"]),
                }),
            ),
            rules: z.object({
                level: z.number(),
                teamSize: z.number(),
                bringCount: z.number(),
                speciesClause: z.boolean(),
                itemClause: z.boolean(),
            }),
        },
        run: (args, env) => validateTeam(args, env),
    },
    {
        name: "analyze_team_types",
        title: "Analyze a team's defensive typing",
        description:
            "For a list of Pokémon, count how many are weak to, resist or are immune to each " +
            "attacking type, and report shared weaknesses, types nothing on the team resists, and " +
            "defensive types that would patch the most gaps. It considers typing only — not " +
            "abilities, items or moves — and suggests types, not specific Pokémon. Pass a Mega " +
            'form\'s name (e.g. "Charizard-Mega-Y") to analyse its post-Mega typing.',
        inputSchema: {
            team: z.array(pokemonInput).min(1).max(6).describe("Pokémon names on the team"),
        },
        outputSchema: {
            team: z.array(z.object({ name: z.string(), types: z.array(z.string()) })),
            notFound: z.array(z.string()).describe("Names that were not recognised and skipped"),
            matchups: z.array(
                z.object({
                    type: z.string().describe("Attacking type"),
                    weak: z.array(z.string()).describe("Team members hit super effectively"),
                    resist: z.array(z.string()),
                    immune: z.array(z.string()),
                }),
            ),
            sharedWeaknesses: z
                .array(z.string())
                .describe("Attacking types that two or more members are weak to"),
            unresisted: z
                .array(z.string())
                .describe("Attacking types no member resists or is immune to"),
            suggestedTypes: z.array(
                z.object({
                    type: z.string(),
                    covers: z.array(z.string()).describe("Weaknesses this type resists"),
                }),
            ),
        },
        run: (args) => analyzeTeamTypes(args),
    },
    {
        name: "get_top_usage",
        title: "Get the most-used Pokémon",
        description:
            "Rank the most-used Pokémon in a regulation by the share of ladder teams they appear " +
            "on, from the most recent month of usage statistics loaded for that regulation (the " +
            "month itself is not reported; get_usage_trend shows dated history). Use it to see " +
            "what a team should expect to face. Mega Evolutions are ranked as separate entries.",
        inputSchema: { format: formatInput, limit: limitInput(20, 50) },
        outputSchema: {
            ...formatOutput,
            battles: z.number().describe("Battles in the month's sample"),
            pokemonCount: z.number().describe("Distinct Pokémon recorded"),
            pokemon: z.array(
                z.object({
                    rank: z.number(),
                    name: z.string(),
                    usagePercent: z.number().describe("Share of teams, 0–100"),
                }),
            ),
        },
        run: (args, env) => getTopUsage(args, env),
    },
    {
        name: "get_pokemon_usage",
        title: "Get how a Pokémon is built",
        description:
            "Show how one Pokémon is typically built in a regulation: its usage and rank, and " +
            "the most common abilities, items, moves and stat spreads as a share of its recorded " +
            "sets. Spreads use the stat-point scale the ladder records (0–32 per stat in " +
            "Pokémon Champions).",
        inputSchema: { pokemon: statsPokemonInput, format: formatInput },
        outputSchema: {
            pokemon: z.string(),
            ...formatOutput,
            usagePercent: z.number().describe("Share of teams, 0–100"),
            rank: z.number(),
            abilities: z.array(share),
            items: z.array(share),
            moves: z.array(share),
            spreads: z.array(
                z.object({
                    nature: z.string(),
                    hp: z.number(),
                    atk: z.number(),
                    def: z.number(),
                    spa: z.number(),
                    spd: z.number(),
                    spe: z.number(),
                    percent: z.number().describe("Share of this Pokémon's recorded sets, 0–100"),
                }),
            ),
        },
        run: (args, env) => getPokemonUsage(args, env),
    },
    {
        name: "get_teammates",
        title: "Get a Pokémon's common teammates",
        description:
            "List the Pokémon that most often share a team with the given Pokémon in a " +
            "regulation, as the share of its teams that include each one. Use it to find proven " +
            "partners and cores.",
        inputSchema: {
            pokemon: statsPokemonInput,
            format: formatInput,
            limit: limitInput(10, 30),
        },
        outputSchema: {
            pokemon: z.string(),
            ...formatOutput,
            teammates: z.array(
                z.object({
                    name: z.string(),
                    percent: z.number().describe("Share of this Pokémon's teams, 0–100"),
                }),
            ),
        },
        run: (args, env) => getTeammates(args, env),
    },
    {
        name: "get_checks_and_counters",
        title: "Get a Pokémon's checks and counters",
        description:
            "List the Pokémon that most reliably beat the given Pokémon on the ladder, ranked by " +
            "Smogon's checks-and-counters score. The data records one-on-one outcomes (a " +
            "knockout or a forced switch), so in doubles treat it as a rough signal. Pokémon " +
            "with few recorded matchups have no data.",
        inputSchema: {
            pokemon: statsPokemonInput,
            format: formatInput,
            limit: limitInput(10, 30),
        },
        outputSchema: {
            pokemon: z.string(),
            ...formatOutput,
            checks: z.array(
                z.object({
                    name: z.string(),
                    score: z
                        .number()
                        .describe("(win rate − 4 × standard deviation) × 100; higher is stronger"),
                    winRatePercent: z
                        .number()
                        .describe("Share of encounters it won by knockout or forced switch"),
                    encounters: z.number(),
                }),
            ),
        },
        run: (args, env) => getChecksAndCounters(args, env),
    },
    {
        name: "get_usage_trend",
        title: "Get a Pokémon's usage over time",
        description:
            "Show one Pokémon's monthly usage and rank in a regulation across a range of months, " +
            "with its net change and peak. History exists only for months the regulation's " +
            "ladder was active.",
        inputSchema: {
            pokemon: statsPokemonInput,
            format: formatInput,
            ...rangeInput,
            months: monthsInput(12),
        },
        outputSchema: {
            pokemon: z.string(),
            ...formatOutput,
            ...rangeOutput,
            points: z.array(
                z.object({
                    month: z.string().describe("YYYY-MM"),
                    usagePercent: z.number(),
                    rank: z.number(),
                }),
            ),
            netChangePoints: z
                .number()
                .describe("Last month's usage minus the first's, in percentage points"),
            peak: z.object({ month: z.string(), usagePercent: z.number() }),
        },
        run: (args, env) => getUsageTrend(args, env),
    },
    {
        name: "get_meta_shifts",
        title: "Compare usage between two months",
        description:
            "Compare a regulation's usage between two months: the biggest risers and fallers, " +
            "Pokémon that newly reached meaningful usage and Pokémon that dropped out. Use it to " +
            "see how the metagame changed. Needs at least two months of history.",
        inputSchema: {
            format: formatInput,
            ...rangeInput,
            months: monthsInput(3),
            limit: limitInput(10, 25),
        },
        outputSchema: {
            ...formatOutput,
            ...rangeOutput,
            risers: z.array(mover),
            fallers: z.array(mover),
            newEntrants: z.array(
                z.object({ name: z.string(), usagePercent: z.number(), rank: z.number() }),
            ),
            dropouts: z.array(z.object({ name: z.string(), previousUsagePercent: z.number() })),
        },
        run: (args, env) => getMetaShifts(args, env),
    },
    {
        name: "get_usage_momentum",
        title: "Find rising and falling Pokémon",
        description:
            "Fit a trend to each Pokémon's monthly usage across a range and list the fastest " +
            "rising, fastest declining and most volatile. These are descriptive trends, not " +
            "forecasts. Needs at least three months of history in the range; with so few points, " +
            "treat the result as a direction, not a measurement.",
        inputSchema: {
            format: formatInput,
            ...rangeInput,
            months: monthsInput(6),
            limit: limitInput(10, 25),
        },
        outputSchema: {
            ...formatOutput,
            ...rangeOutput,
            snapshots: z.number().describe("Monthly snapshots in the range"),
            rising: z.array(momentumEntry),
            declining: z.array(momentumEntry),
            volatile: z.array(
                z.object({
                    name: z.string(),
                    volatilityPoints: z
                        .number()
                        .describe("Standard deviation of month-to-month change, in points"),
                    usagePercent: z.number(),
                }),
            ),
        },
        run: (args, env) => getUsageMomentum(args, env),
    },
    {
        name: "calculate_damage",
        title: "Calculate damage for one move",
        description:
            "Calculate how much damage one move does from one Pokémon to another in Pokémon " +
            "Champions doubles: the damage range, the share of the defender's HP, and the " +
            "chance to knock it out. Use it instead of estimating damage. Any part of a set " +
            "that is left out is filled in from the regulation's usage statistics and listed " +
            "under `assumptions`. A move that hits both opponents is calculated at its reduced " +
            "doubles damage unless `singleTarget` is set. This is one calculation, not a battle " +
            "simulation: it does not account for the rest of the turn, switching or luck " +
            "beyond the damage roll and critical hits.",
        inputSchema: {
            attacker: setInput.describe("The Pokémon using the move"),
            defender: setInput.describe("The Pokémon being hit"),
            move: z.string().min(1).max(40).describe('Move name, for example "Earthquake"'),
            format: formatInput,
            field: z
                .object({
                    weather: weatherInput,
                    terrain: terrainInput,
                    reflect: z.boolean().optional().describe("Reflect on the defender's side"),
                    lightScreen: z.boolean().optional(),
                    auroraVeil: z.boolean().optional(),
                    helpingHand: z.boolean().optional().describe("Attacker has Helping Hand"),
                    friendGuard: z
                        .boolean()
                        .optional()
                        .describe("Defender's ally has Friend Guard"),
                    criticalHit: z.boolean().optional(),
                    singleTarget: z
                        .boolean()
                        .optional()
                        .describe(
                            "Set true when a spread move has only one target left, so it does " +
                                "full damage.",
                        ),
                })
                .strict()
                .optional()
                .describe("Battle conditions. Leave out for none."),
        },
        outputSchema: {
            ...formatOutput,
            attacker: setOutput,
            defender: setOutput,
            move: z.object({
                name: z.string(),
                type: z.string(),
                category: z.string(),
                basePower: z.number(),
            }),
            damage: z.object({
                min: z.number().describe("Lowest damage roll, in HP"),
                max: z.number().describe("Highest damage roll, in HP"),
                minPercent: z.number(),
                maxPercent: z.number(),
                defenderHp: z.number().describe("Defender's maximum HP"),
            }),
            knockOut: z
                .object({
                    hits: z.number().nullable().describe("Hits needed to knock out, if within 9"),
                    chancePercent: z
                        .number()
                        .nullable()
                        .describe("Chance of a knock-out in that many hits, 0–100, when known"),
                    text: z.string(),
                })
                .optional()
                .describe("Absent when the move deals no damage"),
            noDamageReason: z.string().optional(),
            description: z.string().describe("The calculation in standard damage-calc notation"),
            conditions: z.array(z.string()),
            assumptions: assumptionsOutput,
        },
        run: (args, env) => calculateDamage(args, env),
    },
    {
        name: "compare_speed",
        title: "Compare Speed and turn order",
        description:
            "Work out the Speed of several Pokémon in Pokémon Champions and the order they " +
            "move in, including the effect of items such as Choice Scarf, Tailwind, paralysis, " +
            "stat stages, weather abilities and Trick Room. Use it to answer who outspeeds " +
            "whom. Any part of a set that is left out is filled in from the regulation's usage " +
            "statistics and listed under `assumptions`. Speed decides order only among moves " +
            "of the same priority.",
        inputSchema: {
            pokemon: z
                .array(
                    z
                        .object({
                            ...setFields,
                            tailwind: z
                                .boolean()
                                .optional()
                                .describe("This Pokémon's side has Tailwind"),
                            abilityActive: z
                                .boolean()
                                .optional()
                                .describe(
                                    "A conditional Speed ability is active, such as Unburden " +
                                        "after its item is used. Weather abilities follow " +
                                        "`weather` and need no flag.",
                                ),
                        })
                        .strict(),
                )
                .min(1)
                .max(12)
                .describe("The Pokémon to compare. The same Pokémon may appear with two sets."),
            format: formatInput,
            weather: weatherInput,
            terrain: terrainInput,
            trickRoom: z.boolean().optional().describe("Trick Room is up: slower moves first"),
        },
        outputSchema: {
            ...formatOutput,
            trickRoom: z.boolean(),
            order: z
                .array(
                    z.object({
                        pokemon: z.string(),
                        speed: z.number().describe("Speed after every modifier"),
                        speedStat: z.number().describe("Speed stat before modifiers"),
                        nature: z.string(),
                        speedStatPoints: z.number(),
                        ability: z.string(),
                        item: z.string().nullable(),
                        conditions: z.array(z.string()),
                    }),
                )
                .describe("First to move first"),
            ties: z.array(z.array(z.string())).describe("Groups with equal Speed"),
            conditions: z.array(z.string()),
            assumptions: assumptionsOutput,
        },
        run: (args, env) => compareSpeed(args, env),
    },
    {
        name: "check_team_threats",
        title: "Check a team against the most-used Pokémon",
        description:
            "Check a team against the Pokémon it is most likely to face in a regulation. For " +
            "each threat (the most used Pokémon by default, or the ones named) it reports the " +
            "team's hardest hit into it, its hardest hit into the team, and which team members " +
            "outspeed it. Each threat uses its most common set in the regulation's usage " +
            "statistics. Results are single hits with no screens or stat changes, under the " +
            "weather or terrain the attacker's own ability sets if any. This is not a battle " +
            "simulation; use calculate_damage to examine one " +
            "matchup under specific conditions.",
        inputSchema: {
            team: z
                .array(
                    z
                        .object({
                            ...setFields,
                            moves: z
                                .array(z.string().min(1).max(40))
                                .max(4)
                                .optional()
                                .describe(
                                    "This Pokémon's moves. Defaults to its most used attacks " +
                                        "in the regulation.",
                                ),
                        })
                        .strict(),
                )
                .min(1)
                .max(6)
                .describe("The team, one to six Pokémon"),
            format: formatInput,
            threats: z
                .array(statsPokemonInput)
                .max(MAX_THREATS)
                .optional()
                .describe("Pokémon to check against. Defaults to the most used in the regulation."),
            limit: z
                .number()
                .int()
                .min(1)
                .max(MAX_THREATS)
                .optional()
                .describe(
                    `How many of the most used Pokémon to check (1–${MAX_THREATS}). Defaults to 8`,
                ),
        },
        outputSchema: {
            ...formatOutput,
            team: z.array(
                z.object({ pokemon: z.string(), speed: z.number(), moves: z.array(z.string()) }),
            ),
            threats: z.array(
                z.object({
                    pokemon: z.string(),
                    usagePercent: z.number().nullable().describe("Share of teams, 0–100"),
                    set: z.string().describe("Nature and stat points used for the threat"),
                    ability: z.string(),
                    item: z.string().nullable(),
                    speed: z.number(),
                    moves: z.array(z.string()).describe("The threat's most used attacks"),
                    fasterTeamMembers: z.array(z.string()),
                    tiedTeamMembers: z.array(z.string()),
                    bestAnswer: hitOutput.describe("The team's hardest hit into the threat"),
                    biggestRisk: hitOutput.describe("The threat's hardest hit into the team"),
                }),
            ),
            assumptions: assumptionsOutput,
        },
        run: (args, env) => checkTeamThreats(args, env),
    },
];
