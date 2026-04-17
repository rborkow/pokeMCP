import type { RegulationSet } from "./types.js";

/**
 * Pokémon Champions — Regulation M-A.
 *
 * Runs 2026-04-08 through 2026-06-17. First regulation of the Champions
 * Championship Series; debuts at the Indianapolis Regional (2026-05-29).
 *
 * Mega list is sourced from the official announcement. The allowed-Pokémon
 * list is dynamic — fetched from the official legality page by
 * scripts/fetch-champions-legality.ts and loaded from KV at request time.
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
    allowedMegas: [
        "Charizard-Mega-X",
        "Charizard-Mega-Y",
        "Gengar-Mega",
        "Lucario-Mega",
        "Kangaskhan-Mega",
        "Gyarados-Mega",
        "Meganium-Mega",
        "Gardevoir-Mega",
    ],
    bannedItems: [],
    moveOverrides: {},
};
