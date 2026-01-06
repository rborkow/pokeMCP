import type { TeamPokemon } from "@/types/pokemon";
import { getPokemonBaseStats } from "@/lib/data/pokemon-types";

/**
 * Nature modifiers for speed stat
 */
const SPEED_BOOSTING_NATURES = ["Jolly", "Timid", "Hasty", "Naive"];
const SPEED_LOWERING_NATURES = ["Brave", "Relaxed", "Quiet", "Sassy"];

/**
 * Get nature modifier for speed stat
 */
function getNatureModifier(nature?: string): number {
  if (!nature) return 1.0;
  if (SPEED_BOOSTING_NATURES.includes(nature)) return 1.1;
  if (SPEED_LOWERING_NATURES.includes(nature)) return 0.9;
  return 1.0;
}

/**
 * Calculate the final speed stat for a Pokemon
 * Formula: floor((floor((2 * base + IV + floor(EV/4)) * level / 100) + 5) * natureModifier)
 */
export function calculateSpeed(pokemon: TeamPokemon, level = 50): number | null {
  const baseStats = getPokemonBaseStats(pokemon.pokemon);
  if (!baseStats) return null;

  const baseSpeed = baseStats.spe;
  const speedEV = pokemon.evs?.spe ?? 0;
  const speedIV = pokemon.ivs?.spe ?? 31;
  const natureModifier = getNatureModifier(pokemon.nature);

  const stat = Math.floor(
    (Math.floor((2 * baseSpeed + speedIV + Math.floor(speedEV / 4)) * level / 100) + 5) *
      natureModifier
  );

  return stat;
}

/**
 * Speed modifier types for VGC analysis
 */
export interface SpeedModifiers {
  tailwind: number; // x2
  scarf: number; // x1.5 (floored)
  paralysis: number; // x0.5
  icyWind: number; // x0.67 (-1 stage)
  electrowebOrStringShot: number; // x0.67 (-1 stage)
  maxAirstream: number; // +1 stage = x1.5
  trickRoom: boolean; // just flag it
}

/**
 * Get speed stat with various modifiers applied
 */
export function getSpeedWithModifiers(baseSpeed: number): SpeedModifiers {
  return {
    tailwind: baseSpeed * 2,
    scarf: Math.floor(baseSpeed * 1.5),
    paralysis: Math.floor(baseSpeed * 0.5),
    icyWind: Math.floor(baseSpeed * 0.67), // -1 stage approximation
    electrowebOrStringShot: Math.floor(baseSpeed * 0.67),
    maxAirstream: Math.floor(baseSpeed * 1.5), // +1 stage
    trickRoom: true, // Trick Room makes slower go first
  };
}

/**
 * Speed tier classification
 */
export type SpeedTier = "very-fast" | "fast" | "medium" | "slow" | "very-slow";

/**
 * Classify speed into tiers (VGC level 50 context)
 * Benchmarks based on common VGC Pokemon:
 * - Very Fast: 150+ (Regieleki, Swift Swim/Chlorophyll sweepers in weather)
 * - Fast: 120-149 (Dragapult, Flutter Mane, Iron Bundle range)
 * - Medium: 80-119 (Garchomp, Landorus, most common Pokemon)
 * - Slow: 50-79 (Amoonguss, Incineroar, Rillaboom)
 * - Very Slow: <50 (Torkoal, Trick Room sweepers)
 */
export function getSpeedTier(speed: number): SpeedTier {
  if (speed >= 150) return "very-fast";
  if (speed >= 120) return "fast";
  if (speed >= 80) return "medium";
  if (speed >= 50) return "slow";
  return "very-slow";
}

/**
 * Get color class for speed tier
 */
export function getSpeedTierColor(tier: SpeedTier): string {
  switch (tier) {
    case "very-fast":
      return "text-emerald-500";
    case "fast":
      return "text-green-500";
    case "medium":
      return "text-yellow-500";
    case "slow":
      return "text-orange-500";
    case "very-slow":
      return "text-red-500";
  }
}

/**
 * Get background color class for speed tier
 */
export function getSpeedTierBgColor(tier: SpeedTier): string {
  switch (tier) {
    case "very-fast":
      return "bg-emerald-500/20";
    case "fast":
      return "bg-green-500/20";
    case "medium":
      return "bg-yellow-500/20";
    case "slow":
      return "bg-orange-500/20";
    case "very-slow":
      return "bg-red-500/20";
  }
}

/**
 * Common VGC speed benchmarks (level 50)
 */
export const SPEED_BENCHMARKS = [
  { pokemon: "Regieleki", speed: 200, note: "Fastest in format" },
  { pokemon: "Flutter Mane", speed: 187, note: "Max Speed" },
  { pokemon: "Dragapult", speed: 194, note: "Max Speed" },
  { pokemon: "Iron Bundle", speed: 188, note: "Max Speed" },
  { pokemon: "Raging Bolt", speed: 125, note: "Max Speed" },
  { pokemon: "Ogerpon", speed: 178, note: "Max Speed" },
  { pokemon: "Landorus", speed: 168, note: "Max Speed Incarnate" },
  { pokemon: "Garchomp", speed: 169, note: "Max Speed" },
  { pokemon: "Great Tusk", speed: 152, note: "Max Speed" },
  { pokemon: "Urshifu", speed: 163, note: "Max Speed" },
  { pokemon: "Kingambit", speed: 70, note: "Uninvested" },
  { pokemon: "Incineroar", speed: 80, note: "Uninvested (faster after Fake Out)" },
  { pokemon: "Torkoal", speed: 40, note: "Min Speed for Trick Room" },
  { pokemon: "Indeedee-F", speed: 105, note: "Psychic Surge setter" },
] as const;

/**
 * Find speed relationships (what this Pokemon outspeeds/is outsped by)
 */
export function getSpeedRelationships(speed: number): {
  outspeeds: typeof SPEED_BENCHMARKS[number][];
  tiesOrClose: typeof SPEED_BENCHMARKS[number][];
  outspedBy: typeof SPEED_BENCHMARKS[number][];
} {
  const outspeeds: typeof SPEED_BENCHMARKS[number][] = [];
  const tiesOrClose: typeof SPEED_BENCHMARKS[number][] = [];
  const outspedBy: typeof SPEED_BENCHMARKS[number][] = [];

  for (const benchmark of SPEED_BENCHMARKS) {
    const diff = speed - benchmark.speed;
    if (diff > 3) {
      outspeeds.push(benchmark);
    } else if (diff >= -3) {
      tiesOrClose.push(benchmark);
    } else {
      outspedBy.push(benchmark);
    }
  }

  return { outspeeds, tiesOrClose, outspedBy };
}

/**
 * Calculate team speed stats
 */
export interface TeamSpeedInfo {
  pokemon: string;
  speed: number | null;
  tier: SpeedTier | null;
  modifiers: SpeedModifiers | null;
  hasScarf: boolean;
  hasTailwindAccess: boolean;
}

const TAILWIND_POKEMON = [
  "Tornadus",
  "Tornadus-Incarnate",
  "Tornadus-Therian",
  "Whimsicott",
  "Pelipper",
  "Talonflame",
  "Corviknight",
  "Murkrow",
  "Kilowattrel",
  "Oricorio",
  "Oricorio-Pom-Pom",
  "Oricorio-Pa'u",
  "Oricorio-Sensu",
  "Oricorio-Baile",
];

/**
 * Analyze team speed distribution
 */
export function analyzeTeamSpeed(team: TeamPokemon[]): TeamSpeedInfo[] {
  return team.map((pokemon) => {
    const speed = calculateSpeed(pokemon);
    const hasScarf = pokemon.item?.toLowerCase().includes("choice scarf") ?? false;
    const hasTailwind =
      pokemon.moves?.some((m) => m.toLowerCase() === "tailwind") ?? false;
    const hasTailwindAccess =
      hasTailwind || TAILWIND_POKEMON.some((p) => pokemon.pokemon.includes(p));

    return {
      pokemon: pokemon.pokemon,
      speed,
      tier: speed !== null ? getSpeedTier(speed) : null,
      modifiers: speed !== null ? getSpeedWithModifiers(speed) : null,
      hasScarf,
      hasTailwindAccess,
    };
  });
}

/**
 * Check if team has speed control options
 */
export function hasTeamSpeedControl(team: TeamPokemon[]): {
  hasTailwind: boolean;
  hasTrickRoom: boolean;
  hasIcyWind: boolean;
  hasElectroweb: boolean;
  hasThunderWave: boolean;
} {
  const moves = team.flatMap((p) => p.moves ?? []).map((m) => m.toLowerCase());

  return {
    hasTailwind: moves.includes("tailwind"),
    hasTrickRoom: moves.includes("trick room"),
    hasIcyWind: moves.includes("icy wind"),
    hasElectroweb: moves.includes("electroweb"),
    hasThunderWave: moves.includes("thunder wave"),
  };
}
