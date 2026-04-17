/**
 * Data model for Pokémon Champions regulation sets.
 *
 * Champions differs from Showdown-style VGC in several ways that Phase 1 cares
 * about: legality is an explicit allow-list (not a tier), the allow-list rotates
 * per regulation (M-A, M-B, M-C...), and a handful of rules (Mega Evolution,
 * item clause, level 50, 6-bring-4) are regulation-wide.
 *
 * This interface is deliberately concrete about the subset of rules Phase 1
 * enforces. Phase 3 will add Mega post-type data, and Phase 4 will add VP spread
 * data + move overrides; both extend this struct rather than replacing it.
 */

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
     * Statically-known list of Pokémon that can Mega Evolve within this
     * regulation via the Omni Ring. Held as Pokémon names (display form).
     * Phase 1 does not enforce Mega legality — see CHAMPIONS_ROADMAP.
     */
    allowedMegas: string[];
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
