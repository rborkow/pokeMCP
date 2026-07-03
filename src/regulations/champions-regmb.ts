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
    // Official Champions legality page, linked from Pokémon HOME's "Season M-3
    // Underway" news post (champions-news.pokemon-home.com/en/page/778.html).
    // Note the path shape differs from M-A: M-B lives under `/regulations/<id>/`
    // (M-A used `/events/rs…/`). The page ships the allow-list as a client-
    // rendered JS array with parenthetical form labels, which
    // parseChampionsLegalityHtml normalizes to Showdown names (235 mons, all
    // dex-resolved as of 2026-07-03). Re-run fetch-champions-legality /
    // upload-champions-legality to refresh; until the blob is ingested the
    // loader fails loudly rather than silently allowing every team.
    officialLegalityUrl:
        "https://web-view.app.pokemonchampions.jp/battle/pages/regulations/r1780458vgoech/en/pokemon.html",
    legalityKvKey: "champions-regmb:_legality",
    // Verified 2026-07-02: Smogon published Reg M-B usage stats in the 2026-06
    // chaos dump (the first monthly dump after M-B's 2026-06-17 start) under
    // `gen9championsvgc2026regmb`. Setting it here lets the stats tools serve
    // that data against `champions-regmb` and drives the monthly fetch/upload
    // pipeline. (A `gen9championsvgc2026regmbbo3` best-of-3 ladder also exists,
    // but the plain id is the ladder the reports use.)
    showdownFormatId: "gen9championsvgc2026regmb",
    // Verified 2026-07-02: Champions M-B events on play.limitlesstcg.com are
    // listed under game=VGC with format "M-B".
    limitlessFormatId: "M-B",
    // Starting point: Reg M-A's Mega allow-list. Press coverage indicates M-B
    // adds new Pokémon and items, and the exact Mega list is unverified —
    // review against the official M-B regulation when published, and split
    // into a dedicated CHAMPIONS_REGMB_MEGAS in mega-data.ts if it diverges.
    megaForms: CHAMPIONS_REGMA_MEGAS,
    bannedItems: [],
    moveOverrides: {},
};
