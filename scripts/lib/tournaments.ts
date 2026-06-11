/**
 * Shared types + helpers for the Limitless tournament cache
 * (src/cached-tournaments/), written by scripts/fetch-tournaments.ts and
 * consumed by scripts/generate-reports.ts.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const TOURNAMENT_CACHE_DIR = join(process.cwd(), "src", "cached-tournaments");
export const LIMITLESS_ATTRIBUTION = "Data via Limitless (play.limitlesstcg.com)";

export interface TournamentTeamSlot {
    /** Showdown-style species id, e.g. "garchomp". */
    id: string;
    name: string;
    item: string | null;
    ability: string | null;
    moves: string[];
    nature: string | null;
}

export interface TournamentPlacing {
    placing: number;
    player: string;
    country: string | null;
    record: { wins: number; losses: number; ties: number } | null;
    team: TournamentTeamSlot[];
}

export interface TopCutUsageRow {
    id: string;
    name: string;
    /** Teams in the top cut bringing this Pokémon. */
    count: number;
    /** count / topCut.length */
    pct: number;
}

export interface CachedTournament {
    id: string;
    slug: string;
    name: string;
    /** ISO date of the event. */
    date: string;
    players: number;
    format: string;
    regulationId: string;
    source: "limitless";
    sourceUrl: string;
    attribution: string;
    fetchedAt: string;
    topCut: TournamentPlacing[];
    topCutUsage: TopCutUsageRow[];
}

export function eventSlug(name: string, date: string): string {
    const day = date.slice(0, 10);
    const cleaned = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
        .replace(/-+$/g, "");
    return `${day}-${cleaned}`;
}

/** All cached tournaments for a regulation, newest first. */
export function readCachedTournaments(regulationId: string): CachedTournament[] {
    const dir = join(TOURNAMENT_CACHE_DIR, regulationId);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((file) => file.endsWith(".json"))
        .map((file) => JSON.parse(readFileSync(join(dir, file), "utf-8")) as CachedTournament)
        .sort((a, b) => b.date.localeCompare(a.date));
}
