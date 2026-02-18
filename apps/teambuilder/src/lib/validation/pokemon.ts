import type { TeamPokemon, BaseStats } from "@/types/pokemon";
import { NATURES } from "@/types/pokemon";

export interface ValidationError {
    field: string;
    message: string;
    value?: unknown;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

/**
 * Validate EV spread
 * - Each stat must be 0-252
 * - Total must be <= 510
 */
export function validateEvs(evs: Partial<BaseStats> | undefined): ValidationResult {
    const errors: ValidationError[] = [];

    if (!evs) {
        return { valid: true, errors: [] };
    }

    const stats = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
    let total = 0;

    for (const stat of stats) {
        const value = evs[stat];
        if (value !== undefined) {
            if (value < 0 || value > 252) {
                errors.push({
                    field: `evs.${stat}`,
                    message: `${stat.toUpperCase()} EV (${value}) must be between 0 and 252`,
                    value,
                });
            }
            total += value;
        }
    }

    if (total > 510) {
        errors.push({
            field: "evs",
            message: `EV total (${total}) exceeds maximum of 510`,
            value: total,
        });
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate IV spread
 * - Each stat must be 0-31
 */
export function validateIvs(ivs: Partial<BaseStats> | undefined): ValidationResult {
    const errors: ValidationError[] = [];

    if (!ivs) {
        return { valid: true, errors: [] };
    }

    const stats = ["hp", "atk", "def", "spa", "spd", "spe"] as const;

    for (const stat of stats) {
        const value = ivs[stat];
        if (value !== undefined && (value < 0 || value > 31)) {
            errors.push({
                field: `ivs.${stat}`,
                message: `${stat.toUpperCase()} IV (${value}) must be between 0 and 31`,
                value,
            });
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate nature
 * - Must be a valid nature name
 */
export function validateNature(nature: string | undefined): ValidationResult {
    if (!nature) {
        return { valid: true, errors: [] };
    }

    // Normalize nature name (capitalize first letter)
    const normalizedNature = nature.charAt(0).toUpperCase() + nature.slice(1).toLowerCase();

    if (!NATURES[normalizedNature]) {
        return {
            valid: false,
            errors: [
                {
                    field: "nature",
                    message: `"${nature}" is not a valid nature`,
                    value: nature,
                },
            ],
        };
    }

    return { valid: true, errors: [] };
}

/**
 * Validate moves array
 * - Must have 1-4 moves
 */
export function validateMoves(moves: string[] | undefined): ValidationResult {
    const errors: ValidationError[] = [];

    if (!moves || moves.length === 0) {
        errors.push({
            field: "moves",
            message: "Pokemon must have at least 1 move",
        });
    } else if (moves.length > 4) {
        errors.push({
            field: "moves",
            message: `Pokemon can only have 4 moves (got ${moves.length})`,
            value: moves.length,
        });
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate complete Pokemon data
 * Runs all validations and returns combined results
 */
export function validatePokemonData(data: Partial<TeamPokemon>): ValidationResult {
    const allErrors: ValidationError[] = [];

    // Validate EVs
    const evsResult = validateEvs(data.evs);
    allErrors.push(...evsResult.errors);

    // Validate IVs
    const ivsResult = validateIvs(data.ivs);
    allErrors.push(...ivsResult.errors);

    // Validate nature
    const natureResult = validateNature(data.nature);
    allErrors.push(...natureResult.errors);

    // Validate moves
    const movesResult = validateMoves(data.moves);
    allErrors.push(...movesResult.errors);

    return {
        valid: allErrors.length === 0,
        errors: allErrors,
    };
}
