import { SINGLES_THREAT_MATRIX_TIPS, VGC_THREAT_MATRIX_TIPS } from "@/lib/constants/vgc";
import { getPokemonTypes, type PokemonType } from "@/lib/data/pokemon-types";
import type { Mode } from "@/types/pokemon";

/**
 * A parsed meta threat from MCP response data.
 */
export interface MetaThreat {
    pokemon: string;
    usage: number;
    types: PokemonType[];
}

/**
 * A single matchup cell representing defensive and offensive scores.
 */
export interface MatchupCell {
    defScore: number | null; // Defensive: -2 to +2, null if unknown types
    offScore: number | null; // Offensive: -2 to +2, null if unknown types
    defenderTypes: PokemonType[];
    attackerTypes: PokemonType[];
    unknownTypes?: boolean;
}

/**
 * Color legend entry for the threat matrix.
 */
export interface LegendEntry {
    color: string;
    label: string;
}

/**
 * Legend color entries displayed at the bottom of the threat matrix.
 */
export const LEGEND_ENTRIES: LegendEntry[] = [
    { color: "bg-green-600", label: "Excellent" },
    { color: "bg-green-400", label: "Favorable" },
    { color: "bg-gray-500", label: "Even" },
    { color: "bg-red-400", label: "Unfavorable" },
    { color: "bg-red-600", label: "Bad" },
];

/**
 * Parse meta threats from MCP response text.
 * Matches patterns like "1. **Great Tusk** - 30.55% usage"
 */
export function parseMetaThreats(response: string): MetaThreat[] {
    const threats: MetaThreat[] = [];
    const lines = response.split("\n");

    for (const line of lines) {
        const match = line.match(/\d+\.\s+\*?\*?([^*]+)\*?\*?\s*-\s*([\d.]+)%/);
        if (match) {
            const pokemon = match[1].trim();
            const usage = Number.parseFloat(match[2]);
            const types = getPokemonTypes(pokemon);
            // Only include Pokemon with known types
            if (types.length > 0) {
                threats.push({ pokemon, usage, types });
            } else {
                console.warn(`Skipping threat with unknown types: ${pokemon}`);
            }
        }
    }

    return threats;
}

/**
 * Get color class for combined matchup score (average of def + off).
 */
export function getCombinedColor(defScore: number | null, offScore: number | null): string {
    if (defScore === null || offScore === null) return "bg-gray-400/50";
    const combined = (defScore + offScore) / 2;
    if (combined >= 1.5) return "bg-green-600";
    if (combined >= 0.5) return "bg-green-400";
    if (combined >= -0.5) return "bg-gray-500";
    if (combined >= -1.5) return "bg-red-400";
    return "bg-red-600";
}

/**
 * Get score label as multiplier format (more intuitive for Pokemon players).
 */
export function getScoreLabel(score: number | null): string {
    if (score === null) return "?";
    switch (score) {
        case 2:
            return "×4";
        case 1:
            return "×2";
        case 0:
            return "×1";
        case -1:
            return "×½";
        case -2:
            return "×0";
        default:
            return "?";
    }
}

/**
 * Get defensive score description.
 */
export function getDefensiveDescription(score: number | null): string {
    if (score === null) return "Unknown";
    switch (score) {
        case 2:
            return "immune/double resists";
        case 1:
            return "resists";
        case 0:
            return "neutral damage";
        case -1:
            return "weak to";
        case -2:
            return "4x weak to";
        default:
            return "unknown";
    }
}

/**
 * Get offensive score description.
 */
export function getOffensiveDescription(score: number | null): string {
    if (score === null) return "Unknown";
    switch (score) {
        case 2:
            return "4x super effective";
        case 1:
            return "super effective";
        case 0:
            return "neutral damage";
        case -1:
            return "resisted";
        case -2:
            return "immune/double resisted";
        default:
            return "unknown";
    }
}

/**
 * Get overall matchup assessment text.
 */
export function getOverallAssessment(defScore: number | null, offScore: number | null): string {
    if (defScore === null || offScore === null) return "Unknown matchup";
    const combined = defScore + offScore;
    if (combined >= 3) return "Excellent matchup";
    if (combined >= 1) return "Favorable matchup";
    if (combined >= -1) return "Even matchup";
    if (combined >= -3) return "Unfavorable matchup";
    return "Bad matchup";
}

/**
 * Get mode-specific tips for the legend section.
 */
export function getModeTips(mode: Mode): readonly string[] {
    return mode === "vgc" ? VGC_THREAT_MATRIX_TIPS : SINGLES_THREAT_MATRIX_TIPS;
}
