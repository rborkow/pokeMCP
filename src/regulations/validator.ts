import { getFullLearnset, getMove, getPokemon, toID } from "../data-loader.js";
import type { TeamPokemon } from "../types.js";
import { LegalityNotIngestedError, loadRegulation } from "./loader.js";
import { findMegaFormForItem } from "./mega-helpers.js";
import { getRegulation } from "./registry.js";
import type { LoadedRegulation, RegulationSet } from "./types.js";

export type RegulationIssueCode =
    | "empty_team"
    | "team_too_large"
    | "unknown_pokemon"
    | "not_on_allow_list"
    | "species_clause"
    | "item_clause"
    | "multiple_mega_stones"
    | "too_many_moves"
    | "illegal_move"
    | "illegal_ability"
    | "level_normalized";

/** One validation finding, with a stable code so callers can treat rules differently. */
export interface RegulationIssue {
    code: RegulationIssueCode;
    severity: "error" | "warning";
    message: string;
}

/** Per-Pokémon outcome, in input order. */
export interface RegulationMemberResult {
    /** Resolved species name, or the caller's input when the Pokémon is unknown. */
    pokemon: string;
    status: "allowed" | "not_allowed" | "unknown";
}

export interface RegulationValidationResult {
    ok: boolean;
    errors: string[];
    warnings: string[];
    /** Every error and warning, in the order found, with its rule code. */
    issues: RegulationIssue[];
    /** Per-Pokémon summary lines, in input order. */
    memberLines: string[];
    /** Structured counterpart of `memberLines`. */
    members: RegulationMemberResult[];
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
    const issues: RegulationIssue[] = [];
    const memberLines: string[] = [];
    const members: RegulationMemberResult[] = [];
    const error = (code: RegulationIssueCode, message: string) =>
        issues.push({ code, severity: "error", message });

    if (team.length === 0) {
        error("empty_team", "Team is empty.");
    }
    if (team.length > regulation.teamSize) {
        error("team_too_large", `Team has ${team.length} Pokémon (max ${regulation.teamSize})`);
    }

    const speciesSeen = new Map<string, number>();
    const itemsSeen = new Map<string, number>();
    // Champions Omni Ring: at most one Mega Stone across the whole team.
    const megaStoneNames: string[] = [];

    for (const member of team) {
        const species = getPokemon(member.pokemon);
        if (!species) {
            error("unknown_pokemon", `Pokémon "${member.pokemon}" not found`);
            memberLines.push(`- ${member.pokemon}: unknown`);
            members.push({ pokemon: member.pokemon, status: "unknown" });
            continue;
        }

        const pokemonId = toID(species.name);
        const isAllowed = regulation.allowedPokemonIds.has(pokemonId);

        // Allow list check. Forms are matched by toID of the full name, which
        // matches how the Champions page lists forms (e.g. "Landorus-Therian").
        if (!isAllowed) {
            error(
                "not_on_allow_list",
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
                error("species_clause", `Species Clause violation: Multiple ${baseSpecies}`);
            }
        }

        // Item Clause (Champions default).
        if (regulation.enforceItemClause && member.item) {
            const key = toID(member.item);
            const count = (itemsSeen.get(key) ?? 0) + 1;
            itemsSeen.set(key, count);
            if (count > 1) {
                error("item_clause", `Item Clause violation: Multiple Pokémon hold ${member.item}`);
            }
        }

        // Omni Ring: track Mega Stones for a team-level single-Mega check
        // that runs after the loop.
        if (member.item) {
            const megaForm = findMegaFormForItem(member.item, regulation.megaForms);
            if (megaForm) {
                megaStoneNames.push(member.item);
            }
        }

        // Move cap.
        if (member.moves && member.moves.length > regulation.maxMoves) {
            error(
                "too_many_moves",
                `${species.name} has ${member.moves.length} moves (max ${regulation.maxMoves})`,
            );
        }

        // Move legality (Showdown learnset fallback — Phase 4 may overlay
        // Champions-specific move adjustments). The full learnset includes
        // pre-evolution and base-forme moves; a species' own entry alone
        // rejects about a third of the moves actually used on the ladder.
        if (member.moves) {
            const learnset = getFullLearnset(member.pokemon);
            if (learnset) {
                for (const moveName of member.moves) {
                    const moveId = toID(moveName);
                    if (!learnset[moveId]) {
                        const move = getMove(moveName);
                        error(
                            "illegal_move",
                            `${species.name} cannot learn ${move?.name || moveName}`,
                        );
                    }
                }
            }
        }

        // Ability legality uses Showdown data. Champions may diverge in the
        // future, but through Reg M-A the ability pools match.
        if (member.ability) {
            const abilityList = Object.values(species.abilities);
            const abilityId = toID(member.ability);
            if (!abilityList.some((ability) => toID(ability) === abilityId)) {
                error(
                    "illegal_ability",
                    `${species.name} cannot have ability "${member.ability}" (legal: ${abilityList.join(", ")})`,
                );
            }
        }

        // Level enforcement. Champions is auto-level-50; treat omitted as 50.
        if (member.level !== undefined && member.level !== regulation.level) {
            issues.push({
                code: "level_normalized",
                severity: "warning",
                message: `${species.name}: level ${member.level} will be normalized to ${regulation.level} in battle`,
            });
        }

        const allowMarker = isAllowed ? "✓" : "✗ NOT ON ALLOW-LIST";
        memberLines.push(`- ${species.name} ${allowMarker}`);
        members.push({ pokemon: species.name, status: isAllowed ? "allowed" : "not_allowed" });
    }

    // Omni Ring: at most one Mega Stone per team, unless the regulation is
    // known to allow several. Two of the *same* stone is already caught by
    // the Item Clause above; this check catches the mixed-Mega case (e.g.
    // Charizardite X + Gardevoirite).
    if (megaStoneNames.length > 1 && regulation.allowsMultipleMegaStones) {
        issues.push({
            code: "multiple_mega_stones",
            severity: "warning",
            message:
                `Team holds ${megaStoneNames.length} Mega Stones (${megaStoneNames.join(", ")}). ` +
                `${regulation.shortLabel} allows this, but expect only one Pokémon to Mega Evolve per battle.`,
        });
    } else if (megaStoneNames.length > 1) {
        error(
            "multiple_mega_stones",
            `Omni Ring violation: team holds ${megaStoneNames.length} Mega Stones ` +
                `(${megaStoneNames.join(", ")}). At most one Mega Evolution is allowed per team.`,
        );
    }

    const errors = issues.filter((i) => i.severity === "error").map((i) => i.message);
    const warnings = issues.filter((i) => i.severity === "warning").map((i) => i.message);
    return {
        ok: errors.length === 0,
        errors,
        warnings,
        issues,
        memberLines,
        members,
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
