import { toID } from "../data-loader.js";
import type { MegaForm } from "./mega-data.js";
import { getRegulation } from "./registry.js";

/**
 * True if the given item name is the Mega Stone for any Mega form in the
 * given regulation. Callers:
 *   - Teambuilder edit dialog surfaces a warning when a second Mega Stone
 *     is placed on a team.
 *   - Validator counts team-wide Mega Stone occurrences for the Omni-Ring
 *     "one Mega per team" rule.
 *
 * Regulation lookup is optional; passing a regulation object directly is
 * the faster path when the caller already has one loaded.
 */
export function isChampionsMegaStone(
    item: string | undefined,
    regulationIdOrForms: string | MegaForm[] | undefined,
): boolean {
    if (!item) return false;
    const forms = resolveForms(regulationIdOrForms);
    if (!forms) return false;
    const needle = toID(item);
    for (const form of forms) {
        if (toID(form.megaStone) === needle) return true;
    }
    return false;
}

/**
 * Find the Mega form triggered by a given held item within a regulation.
 * Returns `undefined` if the item does not match any Mega Stone in the
 * regulation.
 */
export function findMegaFormForItem(
    item: string | undefined,
    regulationIdOrForms: string | MegaForm[] | undefined,
): MegaForm | undefined {
    if (!item) return undefined;
    const forms = resolveForms(regulationIdOrForms);
    if (!forms) return undefined;
    const needle = toID(item);
    return forms.find((f) => toID(f.megaStone) === needle);
}

function resolveForms(
    regulationIdOrForms: string | MegaForm[] | undefined,
): MegaForm[] | undefined {
    if (!regulationIdOrForms) return undefined;
    if (Array.isArray(regulationIdOrForms)) return regulationIdOrForms;
    const reg = getRegulation(regulationIdOrForms);
    return reg?.megaForms;
}
