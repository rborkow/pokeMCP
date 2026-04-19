import { type PokemonType, TYPES } from "@/types/pokemon";

/**
 * Simplified type effectiveness chart. Value encoding:
 *   1 = attacking type is super-effective vs this defender (2×)
 *   0 = attacking type is resisted by this defender (0.5×)
 *  -1 = attacking type has no effect on this defender (immunity)
 *
 * The outer key is the DEFENDING type; the inner key is the ATTACKING type.
 * Types not listed default to neutral (1×).
 */
export const TYPE_CHART: Record<string, Record<string, number>> = {
    Normal: { Fighting: 1, Ghost: -1 },
    Fire: {
        Water: 1,
        Ground: 1,
        Rock: 1,
        Fire: 0,
        Grass: 0,
        Ice: 0,
        Bug: 0,
        Steel: 0,
        Fairy: 0,
    },
    Water: { Electric: 1, Grass: 1, Fire: 0, Water: 0, Ice: 0, Steel: 0 },
    Electric: { Ground: 1, Electric: 0, Flying: 0, Steel: 0 },
    Grass: {
        Fire: 1,
        Ice: 1,
        Poison: 1,
        Flying: 1,
        Bug: 1,
        Water: 0,
        Electric: 0,
        Grass: 0,
        Ground: 0,
    },
    Ice: { Fire: 1, Fighting: 1, Rock: 1, Steel: 1, Ice: 0 },
    Fighting: { Flying: 1, Psychic: 1, Fairy: 1, Bug: 0, Rock: 0, Dark: 0 },
    Poison: {
        Ground: 1,
        Psychic: 1,
        Grass: 0,
        Fighting: 0,
        Poison: 0,
        Bug: 0,
        Fairy: 0,
    },
    Ground: { Water: 1, Grass: 1, Ice: 1, Electric: -1, Poison: 0, Rock: 0 },
    Flying: {
        Electric: 1,
        Ice: 1,
        Rock: 1,
        Ground: -1,
        Grass: 0,
        Fighting: 0,
        Bug: 0,
    },
    Psychic: { Bug: 1, Ghost: 1, Dark: 1, Fighting: 0, Psychic: 0 },
    Bug: { Fire: 1, Flying: 1, Rock: 1, Grass: 0, Fighting: 0, Ground: 0 },
    Rock: {
        Water: 1,
        Grass: 1,
        Fighting: 1,
        Ground: 1,
        Steel: 1,
        Normal: 0,
        Fire: 0,
        Poison: 0,
        Flying: 0,
    },
    Ghost: { Ghost: 1, Dark: 1, Normal: -1, Fighting: -1, Poison: 0, Bug: 0 },
    Dragon: {
        Ice: 1,
        Dragon: 1,
        Fairy: 1,
        Fire: 0,
        Water: 0,
        Electric: 0,
        Grass: 0,
    },
    Dark: { Fighting: 1, Bug: 1, Fairy: 1, Psychic: -1, Ghost: 0, Dark: 0 },
    Steel: {
        Fire: 1,
        Fighting: 1,
        Ground: 1,
        Poison: -1,
        Normal: 0,
        Grass: 0,
        Ice: 0,
        Flying: 0,
        Psychic: 0,
        Bug: 0,
        Rock: 0,
        Dragon: 0,
        Steel: 0,
        Fairy: 0,
    },
    Fairy: { Poison: 1, Steel: 1, Dragon: -1, Fighting: 0, Bug: 0, Dark: 0 },
};

export interface TypeEntry {
    type: PokemonType;
    count: number;
    pokemon: string[];
}

export interface TypeAnalysis {
    weaknesses: TypeEntry[];
    resistances: TypeEntry[];
    immunities: TypeEntry[];
}

/**
 * Analyze a team's defensive coverage: for each attacking type, how many
 * team members are 2×+ weak to it, 0.5×− resistant to it, or fully immune.
 */
export function analyzeTeamCoverage(
    teamData: { name: string; types: string[] }[],
): TypeAnalysis {
    const weaknessMap: Record<string, string[]> = {};
    const resistMap: Record<string, string[]> = {};
    const immuneMap: Record<string, string[]> = {};

    for (const { name, types } of teamData) {
        for (const attackType of TYPES) {
            let effectiveness = 1;

            for (const defType of types) {
                const chart = TYPE_CHART[defType];
                if (chart && chart[attackType] !== undefined) {
                    if (chart[attackType] === -1) {
                        effectiveness = 0;
                        break;
                    }
                    if (chart[attackType] === 1 || chart[attackType] === 2) {
                        effectiveness *= 2;
                    } else if (chart[attackType] === 0) {
                        effectiveness *= 0.5;
                    }
                }
            }

            if (effectiveness === 0) {
                if (!immuneMap[attackType]) immuneMap[attackType] = [];
                immuneMap[attackType].push(name);
            } else if (effectiveness >= 2) {
                if (!weaknessMap[attackType]) weaknessMap[attackType] = [];
                weaknessMap[attackType].push(name);
            } else if (effectiveness <= 0.5) {
                if (!resistMap[attackType]) resistMap[attackType] = [];
                resistMap[attackType].push(name);
            }
        }
    }

    const toEntries = (map: Record<string, string[]>): TypeEntry[] =>
        Object.entries(map)
            .map(([type, pokemon]) => ({
                type: type as PokemonType,
                count: pokemon.length,
                pokemon,
            }))
            .sort((a, b) => b.count - a.count);

    return {
        weaknesses: toEntries(weaknessMap),
        resistances: toEntries(resistMap),
        immunities: toEntries(immuneMap),
    };
}
