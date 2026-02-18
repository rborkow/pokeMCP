// Pokemon type data for threat matrix calculations
// Type and base stat data is generated from src/data/pokedex.ts
// Re-generate with: npm run generate-pokemon-data
import {
    POKEMON_TYPES as GENERATED_TYPES,
    POKEMON_BASE_STATS as GENERATED_STATS,
} from "./pokemon-data-generated";

export type PokemonType =
    | "Normal"
    | "Fire"
    | "Water"
    | "Electric"
    | "Grass"
    | "Ice"
    | "Fighting"
    | "Poison"
    | "Ground"
    | "Flying"
    | "Psychic"
    | "Bug"
    | "Rock"
    | "Ghost"
    | "Dragon"
    | "Dark"
    | "Steel"
    | "Fairy";

export const POKEMON_TYPES: Record<string, PokemonType[]> = GENERATED_TYPES;

// Type effectiveness chart
// Values: 0 = immune, 0.5 = resist, 1 = neutral, 2 = super effective
export const TYPE_EFFECTIVENESS: Record<PokemonType, Partial<Record<PokemonType, number>>> = {
    Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
    Fire: {
        Fire: 0.5,
        Water: 0.5,
        Grass: 2,
        Ice: 2,
        Bug: 2,
        Rock: 0.5,
        Dragon: 0.5,
        Steel: 2,
    },
    Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
    Electric: {
        Water: 2,
        Electric: 0.5,
        Grass: 0.5,
        Ground: 0,
        Flying: 2,
        Dragon: 0.5,
    },
    Grass: {
        Fire: 0.5,
        Water: 2,
        Grass: 0.5,
        Poison: 0.5,
        Ground: 2,
        Flying: 0.5,
        Bug: 0.5,
        Rock: 2,
        Dragon: 0.5,
        Steel: 0.5,
    },
    Ice: {
        Fire: 0.5,
        Water: 0.5,
        Grass: 2,
        Ice: 0.5,
        Ground: 2,
        Flying: 2,
        Dragon: 2,
        Steel: 0.5,
    },
    Fighting: {
        Normal: 2,
        Ice: 2,
        Poison: 0.5,
        Flying: 0.5,
        Psychic: 0.5,
        Bug: 0.5,
        Rock: 2,
        Ghost: 0,
        Dark: 2,
        Steel: 2,
        Fairy: 0.5,
    },
    Poison: {
        Grass: 2,
        Poison: 0.5,
        Ground: 0.5,
        Rock: 0.5,
        Ghost: 0.5,
        Steel: 0,
        Fairy: 2,
    },
    Ground: {
        Fire: 2,
        Electric: 2,
        Grass: 0.5,
        Poison: 2,
        Flying: 0,
        Bug: 0.5,
        Rock: 2,
        Steel: 2,
    },
    Flying: {
        Electric: 0.5,
        Grass: 2,
        Fighting: 2,
        Bug: 2,
        Rock: 0.5,
        Steel: 0.5,
    },
    Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
    Bug: {
        Fire: 0.5,
        Grass: 2,
        Fighting: 0.5,
        Poison: 0.5,
        Flying: 0.5,
        Psychic: 2,
        Ghost: 0.5,
        Dark: 2,
        Steel: 0.5,
        Fairy: 0.5,
    },
    Rock: {
        Fire: 2,
        Ice: 2,
        Fighting: 0.5,
        Ground: 0.5,
        Flying: 2,
        Bug: 2,
        Steel: 0.5,
    },
    Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
    Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
    Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
    Steel: {
        Fire: 0.5,
        Water: 0.5,
        Electric: 0.5,
        Ice: 2,
        Rock: 2,
        Steel: 0.5,
        Fairy: 2,
    },
    Fairy: {
        Fire: 0.5,
        Fighting: 2,
        Poison: 0.5,
        Dragon: 2,
        Dark: 2,
        Steel: 0.5,
    },
};

// Defensive type chart (what types deal super effective damage to this type)
export const TYPE_WEAKNESSES: Record<PokemonType, PokemonType[]> = {
    Normal: ["Fighting"],
    Fire: ["Water", "Ground", "Rock"],
    Water: ["Electric", "Grass"],
    Electric: ["Ground"],
    Grass: ["Fire", "Ice", "Poison", "Flying", "Bug"],
    Ice: ["Fire", "Fighting", "Rock", "Steel"],
    Fighting: ["Flying", "Psychic", "Fairy"],
    Poison: ["Ground", "Psychic"],
    Ground: ["Water", "Grass", "Ice"],
    Flying: ["Electric", "Ice", "Rock"],
    Psychic: ["Bug", "Ghost", "Dark"],
    Bug: ["Fire", "Flying", "Rock"],
    Rock: ["Water", "Grass", "Fighting", "Ground", "Steel"],
    Ghost: ["Ghost", "Dark"],
    Dragon: ["Ice", "Dragon", "Fairy"],
    Dark: ["Fighting", "Bug", "Fairy"],
    Steel: ["Fire", "Fighting", "Ground"],
    Fairy: ["Poison", "Steel"],
};

export const TYPE_RESISTANCES: Record<PokemonType, PokemonType[]> = {
    Normal: [],
    Fire: ["Fire", "Grass", "Ice", "Bug", "Steel", "Fairy"],
    Water: ["Fire", "Water", "Ice", "Steel"],
    Electric: ["Electric", "Flying", "Steel"],
    Grass: ["Water", "Electric", "Grass", "Ground"],
    Ice: ["Ice"],
    Fighting: ["Bug", "Rock", "Dark"],
    Poison: ["Grass", "Fighting", "Poison", "Bug", "Fairy"],
    Ground: ["Poison", "Rock"],
    Flying: ["Grass", "Fighting", "Bug"],
    Psychic: ["Fighting", "Psychic"],
    Bug: ["Grass", "Fighting", "Ground"],
    Rock: ["Normal", "Fire", "Poison", "Flying"],
    Ghost: ["Poison", "Bug"],
    Dragon: ["Fire", "Water", "Electric", "Grass"],
    Dark: ["Ghost", "Dark"],
    Steel: [
        "Normal",
        "Grass",
        "Ice",
        "Flying",
        "Psychic",
        "Bug",
        "Rock",
        "Dragon",
        "Steel",
        "Fairy",
    ],
    Fairy: ["Fighting", "Bug", "Dark"],
};

export const TYPE_IMMUNITIES: Record<PokemonType, PokemonType[]> = {
    Normal: ["Ghost"],
    Fire: [],
    Water: [],
    Electric: [],
    Grass: [],
    Ice: [],
    Fighting: [],
    Poison: [],
    Ground: ["Electric"],
    Flying: ["Ground"],
    Psychic: [],
    Bug: [],
    Rock: [],
    Ghost: ["Normal", "Fighting"],
    Dragon: [],
    Dark: ["Psychic"],
    Steel: ["Poison"],
    Fairy: ["Dragon"],
};

/**
 * Get Pokemon types from name
 * Tries multiple name formats to handle variations like:
 * - "Great Tusk" vs "great-tusk" vs "greattusk"
 * - "Ogerpon-Wellspring" vs "ogerponwellspring"
 */
export function getPokemonTypes(pokemon: string): PokemonType[] {
    const lower = pokemon.toLowerCase();

    // Try several name formats
    const namesToTry = [
        lower.replace(/[^a-z0-9-]/g, ""), // Keep hyphens: "great-tusk"
        lower.replace(/[^a-z0-9]/g, ""), // No hyphens: "greattusk"
        lower
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, ""), // Spaces to hyphens: "great-tusk"
        lower
            .replace(/\s+/g, "")
            .replace(/[^a-z0-9]/g, ""), // No spaces/hyphens: "greattusk"
    ];

    for (const name of namesToTry) {
        if (POKEMON_TYPES[name]) {
            return POKEMON_TYPES[name];
        }
    }

    // Log unknown Pokemon for debugging (only in dev)
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
        console.warn(`Unknown Pokemon type: "${pokemon}" (tried: ${namesToTry.join(", ")})`);
    }

    // Return empty array for truly unknown Pokemon
    // This makes it clear in the UI that we don't have type data
    return [];
}

/**
 * Calculate type effectiveness multiplier for an attacking type against defending types
 */
export function getTypeEffectiveness(attackType: PokemonType, defenseTypes: PokemonType[]): number {
    let multiplier = 1;

    for (const defType of defenseTypes) {
        const effectiveness = TYPE_EFFECTIVENESS[attackType]?.[defType];
        if (effectiveness !== undefined) {
            multiplier *= effectiveness;
        }
    }

    return multiplier;
}

/**
 * Calculate defensive score for a Pokemon against an attacker's STAB types
 * Returns a score from -2 (very weak) to +2 (very strong)
 */
export function calculateMatchupScore(
    defenderTypes: PokemonType[],
    attackerTypes: PokemonType[],
): number {
    // Start at 0 so we properly track the worst (highest) effectiveness
    // Higher effectiveness = more damage taken = worse for defender
    let worstMatchup = 0;

    // Check each of attacker's STAB types
    for (const attackType of attackerTypes) {
        const effectiveness = getTypeEffectiveness(attackType, defenderTypes);
        if (effectiveness > worstMatchup) {
            worstMatchup = effectiveness;
        }
    }

    // Convert to score: 4x = -2, 2x = -1, 1x = 0, 0.5x = +1, 0.25x or 0x = +2
    if (worstMatchup === 0) return 2; // Immunity
    if (worstMatchup <= 0.25) return 2; // Double resist
    if (worstMatchup <= 0.5) return 1; // Single resist
    if (worstMatchup <= 1) return 0; // Neutral
    if (worstMatchup <= 2) return -1; // Weak
    return -2; // 4x weak
}

/**
 * Calculate offensive score for a Pokemon's STAB types against a target
 * Returns a score from -2 (ineffective) to +2 (super effective)
 */
export function calculateOffensiveScore(
    attackerTypes: PokemonType[],
    defenderTypes: PokemonType[],
): number {
    // Find best STAB effectiveness against target
    let bestMatchup = 0;

    for (const attackType of attackerTypes) {
        const effectiveness = getTypeEffectiveness(attackType, defenderTypes);
        if (effectiveness > bestMatchup) {
            bestMatchup = effectiveness;
        }
    }

    // Convert to score: 4x = +2, 2x = +1, 1x = 0, 0.5x = -1, 0.25x or 0x = -2
    if (bestMatchup >= 4) return 2; // 4x super effective
    if (bestMatchup >= 2) return 1; // Super effective
    if (bestMatchup >= 1) return 0; // Neutral
    if (bestMatchup >= 0.5) return -1; // Resisted
    return -2; // Immune or double resisted
}

/**
 * Base stats interface
 */
export interface BaseStats {
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
}

const POKEMON_BASE_STATS: Record<string, BaseStats> = GENERATED_STATS;

/**
 * Get base stats for a Pokemon by name
 */
export function getPokemonBaseStats(pokemon: string): BaseStats | null {
    const lower = pokemon.toLowerCase();

    // Try several name formats
    const namesToTry = [
        lower.replace(/[^a-z0-9-]/g, ""),
        lower.replace(/[^a-z0-9]/g, ""),
        lower.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        lower.replace(/\s+/g, "").replace(/[^a-z0-9]/g, ""),
    ];

    for (const name of namesToTry) {
        if (POKEMON_BASE_STATS[name]) {
            return POKEMON_BASE_STATS[name];
        }
    }

    return null;
}
