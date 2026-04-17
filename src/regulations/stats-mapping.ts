import { getRegulation } from "./registry.js";

export interface ResolvedStatsFormat {
    /** Format id the stats KV should be queried under. */
    resolvedId: string;
    /** True if the input was remapped from a regulation id to a Showdown id. */
    wasRemapped: boolean;
    /** Original format id the caller passed. */
    originalId: string;
    /**
     * True if the caller passed a Champions regulation id but no Showdown
     * mapping has been configured yet. Consumers should surface a clear
     * "not yet published" message rather than query KV.
     */
    championsUnmapped: boolean;
}

/**
 * Resolve a format id for usage-stats lookups.
 *
 * Champions regulations do not have their own Smogon stats files; they
 * mirror a Showdown-published format once Smogon ingests Champions data
 * (e.g. `champions-regma` → `gen9vgc2026regma`). The mapping lives on the
 * RegulationSet itself — this helper is the single place stats-consuming
 * tools look it up.
 *
 * For non-Champions input (e.g. `gen9ou`, `gen9vgc2026regf`), this is a
 * pass-through: resolvedId === originalId.
 */
export function resolveStatsFormat(format: string): ResolvedStatsFormat {
    const reg = getRegulation(format);
    if (!reg) {
        return {
            resolvedId: format,
            wasRemapped: false,
            originalId: format,
            championsUnmapped: false,
        };
    }
    if (reg.showdownFormatId) {
        return {
            resolvedId: reg.showdownFormatId,
            wasRemapped: true,
            originalId: format,
            championsUnmapped: false,
        };
    }
    return {
        resolvedId: format,
        wasRemapped: false,
        originalId: format,
        championsUnmapped: true,
    };
}
