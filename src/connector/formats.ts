import { z } from "zod";
import { getLatestStatsRegulation, getRegulation, REGULATIONS } from "../regulations/registry.js";
import type { RegulationSet } from "../regulations/types.js";

/**
 * Formats the public connector supports: the registered regulations, and
 * nothing else. Singles tiers and arbitrary Pokémon Showdown ids are
 * deliberately not accepted here — the connector is a VGC tool, and the
 * regulations are the only formats this repo keeps legality and usage data
 * current for.
 */
export const FORMAT_IDS = REGULATIONS.map((r) => r.id) as [string, ...string[]];

/**
 * Format used when a caller omits `format`: the newest regulation with
 * published usage statistics, so every tool works out of the box. Falls back
 * to the newest regulation overall if none has statistics yet.
 */
export function getDefaultRegulation(): RegulationSet {
    return (
        getLatestStatsRegulation() ??
        [...REGULATIONS].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
    );
}

export function resolveRegulation(format: string | undefined): RegulationSet {
    return (format && getRegulation(format)) || getDefaultRegulation();
}

/** Shared `format` input: an optional regulation id. */
export const formatInput = z
    .enum(FORMAT_IDS)
    .optional()
    .describe(
        `Regulation id from list_formats. Defaults to "${getDefaultRegulation().id}" ` +
            `(${getDefaultRegulation().displayName}).`,
    );

/** Echoed on every format-scoped result so the caller knows what was used. */
export const formatOutput = {
    format: z.string().describe("Regulation id the result applies to"),
    formatName: z.string().describe("Display name of the regulation"),
};

export function formatFields(regulation: RegulationSet): { format: string; formatName: string } {
    return { format: regulation.id, formatName: regulation.displayName };
}
