import { getMove, getPokemon, getPokemonLearnset, toID } from "../data-loader.js";
import type { TeamPokemon } from "../types.js";
import { LegalityNotIngestedError, loadRegulation } from "./loader.js";
import { getRegulation } from "./registry.js";
import type { LoadedRegulation, RegulationSet } from "./types.js";

export interface RegulationValidationResult {
    ok: boolean;
    errors: string[];
    warnings: string[];
    /** Per-Pokémon summary lines, in input order. */
    memberLines: string[];
    regulation: RegulationSet;
}

/**
 * Validate a team against a loaded Champions-style regulation. The regulation
 * must already be hydrated from KV; callers should use
 * `validateTeamForRegulationId` when starting from a format id.
 */
export function validateTeamForRegulation(
    team: TeamPokemon[],
    regulation: LoadedRegulation,
): RegulationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const memberLines: string[] = [];

    if (team.length === 0) {
        errors.push("Team is empty.");
    }
    if (team.length > regulation.teamSize) {
        errors.push(`Team has ${team.length} Pokémon (max ${regulation.teamSize})`);
    }

    const speciesSeen = new Map<string, number>();
    const itemsSeen = new Map<string, number>();

    for (const member of team) {
        const species = getPokemon(member.pokemon);
        if (!species) {
            errors.push(`Pokémon "${member.pokemon}" not found`);
            memberLines.push(`- ${member.pokemon}: unknown`);
            continue;
        }

        const pokemonId = toID(species.name);
        const isAllowed = regulation.allowedPokemonIds.has(pokemonId);

        // Allow list check. Forms are matched by toID of the full name, which
        // matches how the Champions page lists forms (e.g. "Landorus-Therian").
        if (!isAllowed) {
            errors.push(
                `${species.name} is not legal in ${regulation.shortLabel} (not on the allowed Pokémon list)`,
            );
        }

        // Species Clause: Pokémon sharing a base species (including forms)
        // count as one.
        if (regulation.enforceSpeciesClause) {
            const baseSpecies = species.baseSpecies || species.name;
            const key = toID(baseSpecies);
            const count = (speciesSeen.get(key) ?? 0) + 1;
            speciesSeen.set(key, count);
            if (count > 1) {
                errors.push(`Species Clause violation: Multiple ${baseSpecies}`);
            }
        }

        // Item Clause (Champions default).
        if (regulation.enforceItemClause && member.item) {
            const key = toID(member.item);
            const count = (itemsSeen.get(key) ?? 0) + 1;
            itemsSeen.set(key, count);
            if (count > 1) {
                errors.push(`Item Clause violation: Multiple Pokémon hold ${member.item}`);
            }
        }

        // Move cap.
        if (member.moves && member.moves.length > regulation.maxMoves) {
            errors.push(
                `${species.name} has ${member.moves.length} moves (max ${regulation.maxMoves})`,
            );
        }

        // Move legality (Showdown learnset fallback — Phase 4 may overlay
        // Champions-specific move adjustments).
        if (member.moves) {
            const learnset = getPokemonLearnset(member.pokemon);
            if (learnset?.learnset) {
                for (const moveName of member.moves) {
                    const moveId = toID(moveName);
                    if (!learnset.learnset[moveId]) {
                        const move = getMove(moveName);
                        errors.push(`${species.name} cannot learn ${move?.name || moveName}`);
                    }
                }
            }
        }

        // Ability legality uses Showdown data. Champions may diverge in the
        // future, but through Reg M-A the ability pools match.
        if (member.ability) {
            const abilityList = Object.values(species.abilities);
            if (!abilityList.includes(member.ability)) {
                errors.push(
                    `${species.name} cannot have ability "${member.ability}" (legal: ${abilityList.join(", ")})`,
                );
            }
        }

        // Level enforcement. Champions is auto-level-50; treat omitted as 50.
        if (member.level !== undefined && member.level !== regulation.level) {
            warnings.push(
                `${species.name}: level ${member.level} will be normalized to ${regulation.level} in battle`,
            );
        }

        const allowMarker = isAllowed ? "✓" : "✗ NOT ON ALLOW-LIST";
        memberLines.push(`- ${species.name} ${allowMarker}`);
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        memberLines,
        regulation,
    };
}

/**
 * Validate a team for a regulation id, handling KV hydration and ingestion
 * errors. Returns a plain result rather than throwing so MCP tool handlers
 * can surface a user-friendly error string.
 */
export async function validateTeamForRegulationId(
    team: TeamPokemon[],
    regulationId: string,
    env: Env,
): Promise<
    { kind: "validated"; result: RegulationValidationResult } | { kind: "error"; message: string }
> {
    const reg = getRegulation(regulationId);
    if (!reg) {
        return { kind: "error", message: `Unknown regulation: ${regulationId}` };
    }

    try {
        const loaded = await loadRegulation(reg, env);
        return { kind: "validated", result: validateTeamForRegulation(team, loaded) };
    } catch (e) {
        if (e instanceof LegalityNotIngestedError) {
            return {
                kind: "error",
                message:
                    `Cannot validate team: legality data for ${reg.shortLabel} has not been ingested. ` +
                    "An administrator must run scripts/fetch-champions-legality.ts. " +
                    "Refusing to fall back to an empty allow-list.",
            };
        }
        throw e;
    }
}
