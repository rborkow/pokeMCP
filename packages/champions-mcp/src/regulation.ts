import { championsDex } from "./showdown.js";

/** Hand-maintained dates from pokemon.com; bump when TPC announces the next set. */
export const CURRENT_REGULATION = {
    id: "champions-regmc",
    displayName: "Pokémon Champions — Regulation M-C",
    startDate: "2026-09-08",
    endDate: "2026-12-01",
    announcementUrl:
        "https://www.pokemon.com/us/news/get-ready-for-regulation-set-m-c-in-pokemon-champions",
    level: 50,
    teamSize: 6,
    bringCount: 4,
    statPointsTotal: 66,
    statPointsPerStat: 32,
} as const;

/**
 * Previous regulation's Showdown id; used as usage fallback until the current
 * one has enough ladder months published (Smogon lags a regulation flip).
 */
export const PREVIOUS_FORMAT_ID = "gen9championsvgc2026regmb";

export interface LegalMega {
    name: string;
    base: string;
    requiredItem: string;
    types: string[];
    ability: string;
}

export interface DexSpecies {
    exists: boolean;
    name: string;
    baseSpecies: string;
    forme?: string;
    tier: string;
    isNonstandard: string | null;
    types: string[];
    requiredItem?: string;
    abilities: Record<string, string>;
}

/** Shared legality predicate: present in the dex, not Illegal, obtainable in the current set. */
export function isLegalSpecies(s: DexSpecies): boolean {
    return (
        s.exists &&
        s.tier !== "Illegal" &&
        s.isNonstandard !== "Past" &&
        s.isNonstandard !== "Unobtainable"
    );
}
const isMega = (s: DexSpecies) => /Mega/.test(s.forme ?? "");

export function legalSpecies(): string[] {
    return (championsDex.species.all() as DexSpecies[])
        .filter((s) => isLegalSpecies(s) && !isMega(s))
        .map((s) => s.name)
        .sort();
}

export function legalMegas(): LegalMega[] {
    return (championsDex.species.all() as DexSpecies[])
        .filter((s) => isLegalSpecies(s) && isMega(s) && s.requiredItem)
        .map((s) => ({
            name: s.name,
            base: s.baseSpecies,
            requiredItem: s.requiredItem as string,
            types: s.types,
            ability: s.abilities["0"],
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function regulationStatus(now = new Date()): {
    state: "upcoming" | "active" | "expired";
    daysLeft: number;
} {
    const start = new Date(`${CURRENT_REGULATION.startDate}T00:00:00-07:00`);
    const end = new Date(`${CURRENT_REGULATION.endDate}T23:59:59-08:00`);
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
    if (now < start) return { state: "upcoming", daysLeft };
    if (now > end) return { state: "expired", daysLeft };
    return { state: "active", daysLeft };
}
