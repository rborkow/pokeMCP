import { CHAMPIONS_REGMA } from "./champions-regma.js";
import { CHAMPIONS_REGMB } from "./champions-regmb.js";
import type { RegulationSet } from "./types.js";

/**
 * Central registry of known regulation sets.
 *
 * Adding a future regulation (e.g. M-B) should be a config change: define the
 * RegulationSet in its own file, import it here, and add to this array. Every
 * consumer (validator, teambuilder UI, ingestion) dispatches by id against
 * this registry.
 */
export const REGULATIONS: readonly RegulationSet[] = [CHAMPIONS_REGMA, CHAMPIONS_REGMB];

const REGULATIONS_BY_ID = new Map(REGULATIONS.map((r) => [r.id, r]));

export function getRegulation(id: string): RegulationSet | undefined {
    return REGULATIONS_BY_ID.get(id);
}

export function isRegulationId(id: string): boolean {
    return REGULATIONS_BY_ID.has(id);
}

export function listRegulationIds(): string[] {
    return [...REGULATIONS_BY_ID.keys()];
}

/**
 * Newest regulation by start date — the registry's notion of the "current"
 * competitive ruleset. Champions replaced mainline VGC as the flagship ladder
 * in 2026, so consumers that need a sensible default format (e.g. meta-trends)
 * key off this instead of a hardcoded VGC id.
 */
export function getLatestRegulation(): RegulationSet | undefined {
    return [...REGULATIONS].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

/**
 * Showdown usage-stats format ids that the regulations mirror.
 *
 * These are the `gen9champions…`-style Smogon formats backing each regulation
 * (via `showdownFormatId`). The stats fetch/upload pipeline reads this so that
 * adding a future regulation with a published stats file is a pure registry
 * change — no edits to the fetch script required. Regulations without a
 * published stats file yet are omitted.
 */
export function listRegulationStatsFormats(): string[] {
    return REGULATIONS.map((r) => r.showdownFormatId).filter(
        (id): id is string => typeof id === "string" && id.length > 0,
    );
}
