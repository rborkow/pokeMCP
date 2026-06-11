import { CHAMPIONS_REGMA_MEGAS } from "./mega-data.js";
import type { RegulationSet } from "./types.js";

/**
 * Pokémon Champions — Regulation M-A.
 *
 * Runs 2026-04-08 through 2026-06-17. First regulation of the Champions
 * Championship Series; debuts at the Indianapolis Regional (2026-05-29).
 *
 * The allowed-Pokémon list is dynamic — fetched from the official legality
 * page by scripts/fetch-champions-legality.ts and loaded from KV at request
 * time. Mega forms live in mega-data.ts so the UI and validator can share
 * one source of truth for post-Mega types/stats/abilities.
 */
export const CHAMPIONS_REGMA: RegulationSet = {
    id: "champions-regma",
    displayName: "Pokémon Champions — Regulation M-A",
    shortLabel: "Champions Reg M-A",
    platform: "champions",
    startDate: "2026-04-08",
    endDate: "2026-06-17",
    level: 50,
    teamSize: 6,
    bringCount: 4,
    enforceSpeciesClause: true,
    enforceItemClause: true,
    maxMoves: 4,
    officialLegalityUrl:
        "https://web-view.app.pokemonchampions.jp/battle/pages/events/rs177501629259kmzbny/en/pokemon.html",
    legalityKvKey: "champions-regma:_legality",
    // Smogon publishes Champions usage stats under a `gen9champions…` prefix
    // (not the `gen9vgc…` shape originally anticipated). Reg M-A's VGC-style
    // doubles ladder lives at `gen9championsvgc2026regma`; setting it here lets
    // the stats tools transparently serve that data against `champions-regma`,
    // and drives which file the monthly fetch/upload pipeline pulls.
    showdownFormatId: "gen9championsvgc2026regma",
    // Verified June 2026: Champions events on play.limitlesstcg.com are listed
    // under game=VGC with format "M-A".
    limitlessFormatId: "M-A",
    megaForms: CHAMPIONS_REGMA_MEGAS,
    bannedItems: [],
    moveOverrides: {},
};
