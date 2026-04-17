import { CHAMPIONS_REGMA } from "./champions-regma.js";
import type { RegulationSet } from "./types.js";

/**
 * Central registry of known regulation sets.
 *
 * Adding a future regulation (e.g. M-B) should be a config change: define the
 * RegulationSet in its own file, import it here, and add to this array. Every
 * consumer (validator, teambuilder UI, ingestion) dispatches by id against
 * this registry.
 */
export const REGULATIONS: readonly RegulationSet[] = [CHAMPIONS_REGMA];

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
