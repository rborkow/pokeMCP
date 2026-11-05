import { CHAMPIONS_REGMC_MEGAS } from "./mega-data.js";
import type { RegulationSet } from "./types.js";

/**
 * Pokémon Champions — Regulation M-C.
 * Runs 2026-09-08 19:00 PDT → 2026-12-01 17:59 PST (pokemon.com announcement,
 * "Get Ready for Regulation Set M-C"). 24 new Pokémon (incl. Rillaboom) and
 * 6 new Megas on top of the M-B roster.
 *
 * Showdown id verified 2026-09-19 against smogon/pokemon-showdown master
 * (config/formats.ts: "[Gen 9 Champions] VGC 2026 Reg M-C", mod "champions").
 * Smogon usage stats for this id are expected in the 2026-09 monthly dump.
 * Limitless lists M-C events under game=VGC, format "M-C" (verified 2026-09-19).
 */
export const CHAMPIONS_REGMC: RegulationSet = {
    id: "champions-regmc",
    displayName: "Pokémon Champions — Regulation M-C",
    shortLabel: "Champions Reg M-C",
    platform: "champions",
    startDate: "2026-09-08",
    endDate: "2026-12-01",
    level: 50,
    teamSize: 6,
    bringCount: 4,
    enforceSpeciesClause: true,
    enforceItemClause: true,
    maxMoves: 4,
    // Official M-C legality web-view URL not yet located, so
    // scripts/fetch-champions-legality.ts cannot ingest it and loadRegulation()
    // throws LegalityNotIngestedError for this id until `officialLegalityUrl` is
    // set. A Showdown-mod-derived roster is planned as an alternative source.
    legalityKvKey: "champions-regmc:_legality",
    showdownFormatId: "gen9championsvgc2026regmc",
    limitlessFormatId: "M-C",
    megaForms: CHAMPIONS_REGMC_MEGAS,
    bannedItems: [],
    moveOverrides: {},
};
