import type { TeamPokemon } from "@/types/pokemon";
import type { TeamAction } from "@/types/chat";
import { type ValidationError, validatePokemonData } from "@/lib/validation/pokemon";
import type { ModifyTeamInput } from "./tools";

/**
 * Parse a tool input into a TeamAction
 */
export function parseToolToAction(
    toolInput: ModifyTeamInput,
    team: TeamPokemon[],
    slotOffset = 0,
): TeamAction | undefined {
    try {
        // Build the preview team
        const preview = [...team];
        const slot = toolInput.slot ?? team.length + slotOffset;

        // Snapshot the current Pokemon at this slot before applying the action
        const previousState: Partial<TeamPokemon> | undefined = team[slot]
            ? { ...team[slot] }
            : undefined;

        if (toolInput.action_type === "remove_pokemon") {
            preview.splice(slot, 1);
        } else if (
            toolInput.action_type === "add_pokemon" ||
            toolInput.action_type === "replace_pokemon"
        ) {
            // For add/replace, create a new Pokemon with all provided fields
            const newPokemon: TeamPokemon = {
                pokemon: toolInput.pokemon || "",
                moves: toolInput.moves || [],
                ability: toolInput.ability,
                item: toolInput.item,
                nature: toolInput.nature,
                teraType: toolInput.tera_type,
                evs: toolInput.evs,
                ivs: toolInput.ivs,
            };

            if (toolInput.action_type === "add_pokemon") {
                preview.push(newPokemon);
            } else {
                // Full replacement at slot
                preview[slot] = newPokemon;
            }
        } else if (toolInput.action_type === "update_pokemon") {
            // For updates, only merge provided fields (preserve existing data)
            const updates: Partial<TeamPokemon> = {};
            if (toolInput.pokemon !== undefined) updates.pokemon = toolInput.pokemon;
            if (toolInput.moves !== undefined && toolInput.moves.length > 0)
                updates.moves = toolInput.moves;
            if (toolInput.ability !== undefined) updates.ability = toolInput.ability;
            if (toolInput.item !== undefined) updates.item = toolInput.item;
            if (toolInput.nature !== undefined) updates.nature = toolInput.nature;
            if (toolInput.tera_type !== undefined) updates.teraType = toolInput.tera_type;
            if (toolInput.evs !== undefined) updates.evs = toolInput.evs;
            if (toolInput.ivs !== undefined) updates.ivs = toolInput.ivs;

            if (preview[slot]) {
                preview[slot] = { ...preview[slot], ...updates };
            } else {
                // No existing Pokemon at slot - treat as add
                preview[slot] = {
                    pokemon: toolInput.pokemon || "",
                    moves: toolInput.moves || [],
                    ability: toolInput.ability,
                    item: toolInput.item,
                    nature: toolInput.nature,
                    teraType: toolInput.tera_type,
                    evs: toolInput.evs,
                    ivs: toolInput.ivs,
                };
            }
        }

        // Build payload from tool input (only include non-empty fields)
        const payload: Partial<TeamPokemon> = {};
        if (toolInput.pokemon) payload.pokemon = toolInput.pokemon;
        if (toolInput.moves && toolInput.moves.length > 0) payload.moves = toolInput.moves;
        if (toolInput.ability) payload.ability = toolInput.ability;
        if (toolInput.item) payload.item = toolInput.item;
        if (toolInput.nature) payload.nature = toolInput.nature;
        if (toolInput.tera_type) payload.teraType = toolInput.tera_type;
        if (toolInput.evs) payload.evs = toolInput.evs;
        if (toolInput.ivs) payload.ivs = toolInput.ivs;

        // Validate the payload for add/update operations
        let validationErrors: ValidationError[] | undefined;
        if (toolInput.action_type !== "remove_pokemon") {
            const validation = validatePokemonData(payload);
            if (!validation.valid) {
                validationErrors = validation.errors;
            }
        }

        // Map action type — for update_pokemon, infer specific type from fields
        let actionType: TeamAction["type"];
        if (toolInput.action_type === "update_pokemon") {
            if (
                toolInput.move_slot !== undefined &&
                toolInput.moves &&
                toolInput.moves.length > 0
            ) {
                actionType = "update_move";
                // Propagate move_slot into payload for ActionCard display
                (payload as Record<string, unknown>).moveSlot = toolInput.move_slot;
            } else if (toolInput.moves && toolInput.moves.length > 0) {
                actionType = "update_moveset";
            } else if (
                toolInput.item &&
                !toolInput.ability &&
                !toolInput.nature &&
                !toolInput.evs &&
                !toolInput.tera_type
            ) {
                actionType = "update_item";
            } else if (
                toolInput.ability &&
                !toolInput.item &&
                !toolInput.nature &&
                !toolInput.evs &&
                !toolInput.tera_type
            ) {
                actionType = "update_ability";
            } else if (
                toolInput.nature &&
                !toolInput.item &&
                !toolInput.ability &&
                !toolInput.evs &&
                !toolInput.tera_type
            ) {
                actionType = "update_nature";
            } else if (
                toolInput.evs &&
                !toolInput.item &&
                !toolInput.ability &&
                !toolInput.nature &&
                !toolInput.tera_type
            ) {
                actionType = "update_evs";
            } else if (
                toolInput.tera_type &&
                !toolInput.item &&
                !toolInput.ability &&
                !toolInput.nature &&
                !toolInput.evs
            ) {
                actionType = "update_tera_type";
            } else {
                actionType = "update_moveset"; // Fallback for multi-field updates
            }
        } else {
            const typeMap: Record<string, TeamAction["type"]> = {
                add_pokemon: "add_pokemon",
                replace_pokemon: "replace_pokemon",
                remove_pokemon: "remove_pokemon",
            };
            actionType = typeMap[toolInput.action_type] || "add_pokemon";
        }

        return {
            type: actionType,
            slot: slot,
            payload: payload,
            preview: preview.filter(Boolean),
            reason: toolInput.reason || "AI suggestion",
            validationErrors,
            previousState,
        };
    } catch (e) {
        console.error("Failed to parse tool to action:", e);
        return undefined;
    }
}
