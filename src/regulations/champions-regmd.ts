import { CHAMPIONS_REGMD_MEGAS } from "./mega-data.js";
import type { RegulationSet } from "./types.js";

/**
 * Pokémon Champions — Regulation M-D.
 *
 * Runs 2026-12-02 02:00 UTC → 2027-03-03 01:59 UTC, per the in-game news post
 * "Regulation Set M-D" (champions-news.pokemon-home.com/en/page/878.html),
 * which matches M-C's end (2026-12-02 01:59 UTC) and Ranked Season M-8's end.
 * The pokemon.com article ("Regulation Set M-D Is Coming to Pokémon
 * Champions", 2026-11-24) gives "December 2, 6:00 p.m. PST", a day later than
 * the UTC time; the in-game post is taken as authoritative.
 *
 * Like every earlier regulation, the dates below are the Pacific calendar
 * dates of the start and end (2026-12-01 18:00 PST and 2027-03-02 17:59 PST),
 * so M-C's `endDate` equals this `startDate`.
 *
 * Adds 24 Pokémon (Heatran, Dondozo, Tatsugiri, …) and four Mega Evolutions
 * (Mega Heatran, Mega Tatsugiri, …) on top of the M-C roster.
 */
export const CHAMPIONS_REGMD: RegulationSet = {
    id: "champions-regmd",
    displayName: "Pokémon Champions — Regulation M-D",
    shortLabel: "Champions Reg M-D",
    platform: "champions",
    startDate: "2026-12-01",
    endDate: "2027-03-02",
    level: 50,
    teamSize: 6,
    bringCount: 4,
    enforceSpeciesClause: true,
    enforceItemClause: true,
    maxMoves: 4,
    // The official eligible-Pokémon page is not published yet: the in-game
    // M-D post (2026-11-24) says full details come later and links no list.
    // Each Ranked season's post links its own page (M-8's is under
    // `/events/rs179091661073gghbfx/`), so look for the Season M-9 post around
    // 2026-12-02. Until the URL is set and the list ingested, validate_team
    // for M-D fails loudly rather than allowing every team.
    legalityKvKey: "champions-regmd:_legality",
    // `showdownFormatId` is deliberately unset. The connector's default format
    // is the newest regulation with it set (getLatestStatsRegulation), and it
    // also drives fetch-stats, verify-stats and generate-reports. Smogon will
    // not publish M-D usage until its 2026-12 dump (early January), and
    // Pokémon Showdown has no M-D format yet, so setting it now would point
    // every default at a regulation with no data. Set it once the id is
    // verified in Showdown's config/formats.ts and Smogon's stats directory,
    // as was done for M-B (4b6f400).
    //
    // Pattern-derived ("M-A", "M-B", "M-C"), not yet verified against live
    // Limitless events. Safe either way: ingestion derives the same id and
    // label for an unregistered "M-D", and fetch-tournaments finds no events.
    limitlessFormatId: "M-D",
    megaForms: CHAMPIONS_REGMD_MEGAS,
    // M-B and M-C both allow several Mega Stones per team; nothing announced
    // for M-D changes that.
    allowsMultipleMegaStones: true,
    bannedItems: [],
    moveOverrides: {},
};
