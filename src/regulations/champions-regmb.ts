import { CHAMPIONS_REGMA_MEGAS } from "./mega-data.js";
import type { RegulationSet } from "./types.js";

/**
 * Pokémon Champions — Regulation M-B.
 *
 * Starts 2026-06-17 (coinciding with the Champions mobile launch), directly
 * succeeding Regulation M-A. No end date has been announced yet — set
 * `endDate` once The Pokémon Company publishes the M-C transition.
 *
 * The allowed-Pokémon list is dynamic — fetched from the official legality
 * page by scripts/fetch-champions-legality.ts and loaded from KV at request
 * time, under this regulation's own KV key.
 */
export const CHAMPIONS_REGMB: RegulationSet = {
    id: "champions-regmb",
    displayName: "Pokémon Champions — Regulation M-B",
    shortLabel: "Champions Reg M-B",
    platform: "champions",
    startDate: "2026-06-17",
    level: 50,
    teamSize: 6,
    bringCount: 4,
    enforceSpeciesClause: true,
    enforceItemClause: true,
    maxMoves: 4,
    // The official web-view legality page mints a fresh event-id per
    // regulation (see scripts/fetch-champions-legality.ts). The M-B page was
    // not yet published/parseable at the time of writing — set
    // officialLegalityUrl once it goes live, then run the
    // fetch-champions-legality / upload-champions-legality ingestion pair.
    // Until the legality blob is ingested, the loader fails loudly rather
    // than silently allowing every team.
    legalityKvKey: "champions-regmb:_legality",
    // Smogon has not yet published Reg M-B usage stats. The expected id is
    // `gen9championsvgc2026regmb`, anticipated in Smogon's 2026-07-01 stats
    // dump (the first monthly dump after M-B's 2026-06-17 start). Flip this
    // field to that id when it appears; until then `showdownFormatId` stays
    // undefined and the stats tools surface the "not yet published" message.
    // showdownFormatId: "gen9championsvgc2026regmb",
    // Limitless format string for M-B is likewise unverified until events
    // appear on play.limitlesstcg.com after 2026-06-17. Expected value "M-B" —
    // verify with GET /api/tournaments?game=VGC&format=M-B, then flip:
    // limitlessFormatId: "M-B",
    // Starting point: Reg M-A's Mega allow-list. Press coverage indicates M-B
    // adds new Pokémon and items, and the exact Mega list is unverified —
    // review against the official M-B regulation when published, and split
    // into a dedicated CHAMPIONS_REGMB_MEGAS in mega-data.ts if it diverges.
    megaForms: CHAMPIONS_REGMA_MEGAS,
    bannedItems: [],
    moveOverrides: {},
};
