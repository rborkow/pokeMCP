/**
 * Data model for Pokémon Champions regulation sets.
 *
 * Champions differs from Showdown-style VGC in several ways that Phase 1 cares
 * about: legality is an explicit allow-list (not a tier), the allow-list rotates
 * per regulation (M-A, M-B, M-C...), and a handful of rules (Mega Evolution,
 * item clause, level 50, 6-bring-4) are regulation-wide.
 *
 * This interface is deliberately concrete about the subset of rules each
 * phase enforces. Phase 3a carries post-Mega data; Phase 4 will add VP
 * spread data + move overrides.
 */

import type { MegaForm } from "./mega-data.js";

export type RegulationPlatform = "champions" | "showdown";

export interface RegulationSet {
    /** Internal identifier, e.g. "champions-regma". Lowercase, kebab-cased. */
    id: string;
    /** Human-readable name, e.g. "Pokémon Champions — Regulation M-A". */
    displayName: string;
    /** Short label for UI chips/banners, e.g. "Champions Reg M-A". */
    shortLabel: string;
    /** Platform the regulation belongs to. */
    platform: RegulationPlatform;
    /** ISO date (YYYY-MM-DD) the regulation becomes legal. */
    startDate: string;
    /** ISO date (YYYY-MM-DD) the regulation stops being legal. */
    endDate: string;
    /** Fixed level at which Pokémon battle under this regulation. */
    level: number;
    /** Team size minted on the bring-N team preview (e.g. 6). */
    teamSize: number;
    /** Number of Pokémon brought to each battle (e.g. 4 for Champions doubles). */
    bringCount: number;
    /** Species-Clause style restriction: no two Pokémon sharing a base species. */
    enforceSpeciesClause: boolean;
    /**
     * Item clause style restriction: no two Pokémon sharing a held item.
     * Champions regulations enforce this by default.
     */
    enforceItemClause: boolean;
    /** Maximum moves per Pokémon. Always 4 for current Champions. */
    maxMoves: number;
    /**
     * URL to the official legality page. Kept for diagnostics / ingestion
     * scripts; not consumed by the Worker at runtime.
     */
    officialLegalityUrl?: string;
    /**
     * KV key under `POKEMON_STATS` where the dynamic legality data (fetched
     * from the official Champions page) lives. See fetchChampionsLegality.
     */
    legalityKvKey: string;
    /**
     * Mega Evolutions legal within this regulation via the Omni Ring.
     * Holds full `MegaForm` entries (post-Mega types, ability, stats,
     * required Mega Stone item) so consumers can render the "as-Mega"
     * state without extra lookups. Phase 3a adds the data model and
     * enforces "at most one Mega Stone per team"; Phase 3b consumes
     * post-Mega type data in the analysis UI.
     */
    megaForms: MegaForm[];
    /**
     * Items banned for this regulation regardless of the item clause.
     * Phase 1 does not enforce — see CHAMPIONS_ROADMAP.
     */
    bannedItems: string[];
    /**
     * Regulation-specific move overrides (e.g. Dire Claw nerf). Phase 1
     * leaves this empty; Phase 4 will populate and apply.
     */
    moveOverrides: Record<string, Partial<MoveOverride>>;
    /**
     * Showdown usage-stats format identifier this regulation mirrors,
     * when one exists. Smogon publishes Champions stats under a
     * `gen9champions…` prefix (e.g. `gen9championsvgc2026regma` for Reg
     * M-A's doubles ladder); set this to that id so `get_usage_stats` can
     * transparently serve Showdown data against the Champions format. It
     * also drives which file the monthly fetch/upload pipeline pulls. Leave
     * undefined until Smogon publishes — an unmapped Champions format
     * surfaces a clear "not yet published" message rather than empty data.
     */
    showdownFormatId?: string;
}

/**
 * Sparse move overrides applied on top of Showdown data for a given
 * regulation. Only fields that differ need to be set.
 */
export interface MoveOverride {
    basePower?: number;
    accuracy?: number | true;
    pp?: number;
    priority?: number;
    notes?: string;
}

/**
 * Runtime-enriched regulation: the static config merged with dynamic data
 * fetched from KV (primarily the allowed-Pokémon list).
 */
export interface LoadedRegulation extends RegulationSet {
    /** Pokémon toID()-normalised names allowed by this regulation. */
    allowedPokemonIds: Set<string>;
    /** Pokémon display names in the order returned by the official source. */
    allowedPokemonDisplay: string[];
    /** ISO timestamp when the dynamic legality data was fetched. */
    fetchedAt: string;
    /** Version marker from the ingestion script, for future compatibility. */
    dataVersion: number;
}

/**
 * Shape of the JSON blob written to KV by the legality ingestion script.
 * Kept narrow so the loader can validate it defensively at read time.
 */
export interface LegalityKvBlob {
    regulationId: string;
    fetchedAt: string;
    sourceUrl: string;
    version: number;
    pokemon: string[];
}
