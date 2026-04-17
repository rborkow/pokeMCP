/**
 * Client-side helpers for Pokémon Champions analysis overlays.
 *
 * The Omni Ring rule allows at most one Mega Stone per team, which the MCP
 * Worker's validator enforces. That invariant lets us auto-detect the
 * "active Mega" — it's simply whichever Pokémon holds a Mega Stone — so
 * analysis panels can surface post-Mega types without a picker.
 *
 * Consumers: `TypeCoverage`, `ThreatMatrix`, `SpeedTiers` (later), and any
 * future Champions-specific panel that needs to render the "as-Mega" state.
 */

import { CHAMPIONS_REGMA_MEGAS, type MegaForm } from "@/lib/data/champions-megas";
import { getPokemonTypes, type PokemonType } from "@/lib/data/pokemon-types";
import { toID } from "@/lib/showdown-parser";
import { isChampionsFormat } from "@/types/pokemon";
import type { TeamPokemon } from "@/types/pokemon";

/**
 * Mega form list for a format id. Returns `undefined` for non-Champions
 * formats so callers can skip overlay logic cheaply.
 *
 * Extend this when M-B ships: add another branch or consult a registry.
 * For now the mapping is explicit to keep one-click grep-ability.
 */
export function getMegaFormsForFormat(formatId: string): MegaForm[] | undefined {
    if (formatId === "champions-regma") return CHAMPIONS_REGMA_MEGAS;
    return undefined;
}

export function findMegaFormForItem(
    item: string | undefined,
    forms: MegaForm[] | undefined,
): MegaForm | undefined {
    if (!item || !forms) return undefined;
    const needle = toID(item);
    return forms.find((f) => toID(f.megaStone) === needle);
}

/**
 * Detect which team slot holds the active Mega Stone, if any.
 *
 * Returns -1 when:
 *   - the format is not a Champions regulation,
 *   - no team member holds a known Mega Stone,
 *   - or the Pokémon holding the stone does not match the stone's basePokemon
 *     (wrong-stone case — the validator still flags this separately).
 */
export function getActiveMegaSlot(team: TeamPokemon[], formatId: string): number {
    if (!isChampionsFormat(formatId)) return -1;
    const forms = getMegaFormsForFormat(formatId);
    if (!forms) return -1;

    for (let i = 0; i < team.length; i++) {
        const member = team[i];
        const form = findMegaFormForItem(member.item, forms);
        if (!form) continue;
        // Stone must match the Pokémon species for the Mega to trigger.
        if (toID(member.pokemon) !== toID(form.basePokemon)) continue;
        return i;
    }
    return -1;
}

/**
 * Get the active Mega form for a team in a given format, or undefined.
 * Same resolution rules as getActiveMegaSlot().
 */
export function getActiveMegaForm(team: TeamPokemon[], formatId: string): MegaForm | undefined {
    const slot = getActiveMegaSlot(team, formatId);
    if (slot < 0) return undefined;
    const forms = getMegaFormsForFormat(formatId);
    if (!forms) return undefined;
    const member = team[slot];
    return findMegaFormForItem(member.item, forms);
}

/**
 * Types to use for a team member in analysis panels.
 *
 * Returns post-Mega types when the member holds the active Mega Stone AND
 * the form has post-Mega types populated (championsExclusive Megas whose
 * data is pending fall back to the base types with a warning from
 * `isMegaDataPending()`).
 *
 * Falls back to `getPokemonTypes(pokemon)` for every other case.
 */
export function getEffectiveTypes(
    member: TeamPokemon,
    team: TeamPokemon[],
    formatId: string,
): PokemonType[] {
    const activeSlot = getActiveMegaSlot(team, formatId);
    if (activeSlot < 0) return getPokemonTypes(member.pokemon);
    if (team[activeSlot] !== member) return getPokemonTypes(member.pokemon);

    const form = getActiveMegaForm(team, formatId);
    if (!form || !form.postMegaTypes || form.postMegaTypes.length === 0) {
        return getPokemonTypes(member.pokemon);
    }
    return form.postMegaTypes;
}

/**
 * True if the active Mega in this team exists but its post-Mega data is
 * still pending (Champions-exclusive Megas like Meganium-Mega). UI
 * consumers use this to render a "data pending" notice beside the
 * overlay.
 */
export function isActiveMegaDataPending(team: TeamPokemon[], formatId: string): boolean {
    const form = getActiveMegaForm(team, formatId);
    if (!form) return false;
    return !form.postMegaTypes || form.postMegaTypes.length === 0;
}
