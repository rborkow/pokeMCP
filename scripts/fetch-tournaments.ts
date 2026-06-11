/**
 * Fetch Pokémon Champions tournament results + full teams from the Limitless
 * tournament platform (play.limitlesstcg.com) into a repo-committed cache at
 * src/cached-tournaments/{regulationId}/{event-slug}.json.
 *
 * Which regulations are fetched is driven by `limitlessFormatId` in
 * src/regulations/ (same pattern as showdownFormatId for Smogon stats).
 * Only completed events with published decklists and >= MIN_PLAYERS players
 * are cached. Existing cache files are not re-fetched (idempotent monthly
 * runs); set FORCE=1 to refresh.
 *
 * The Limitless API is public and keyless at low volume; set LIMITLESS_API_KEY
 * to send an X-Access-Key header if a key has been granted. Be polite either
 * way. Docs: https://docs.limitlesstcg.com/developer.html
 *
 * Usage:
 *   bun run fetch-tournaments                 # default: last 35 days
 *   WINDOW_DAYS=60 bun run fetch-tournaments
 *   MIN_PLAYERS=24 bun run fetch-tournaments
 *   FORCE=1 bun run fetch-tournaments         # re-fetch cached events
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REGULATIONS } from "../src/regulations/registry.js";
import {
    type CachedTournament,
    eventSlug,
    LIMITLESS_ATTRIBUTION,
    TOURNAMENT_CACHE_DIR,
    type TournamentPlacing,
    type TournamentTeamSlot,
} from "./lib/tournaments.js";

const API_BASE = "https://play.limitlesstcg.com/api";
const WINDOW_DAYS = Number(process.env.WINDOW_DAYS || 35);
const MIN_PLAYERS = Number(process.env.MIN_PLAYERS || 48);
const FORCE = process.env.FORCE === "1";
const FETCH_DELAY_MS = Number(process.env.FETCH_DELAY_MS || 2000);
const PAGE_LIMIT = 100;
const MAX_PAGES = 5;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toID(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

let lastFetch = 0;
async function api<T>(path: string): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.LIMITLESS_API_KEY) headers["X-Access-Key"] = process.env.LIMITLESS_API_KEY;

    for (let attempt = 0; ; attempt++) {
        const wait = lastFetch + FETCH_DELAY_MS - Date.now();
        if (wait > 0) await delay(wait);
        lastFetch = Date.now();

        const response = await fetch(`${API_BASE}${path}`, { headers });
        if (response.status === 429 && attempt < 4) {
            const retryAfter = Number(response.headers.get("retry-after"));
            const backoff = Number.isFinite(retryAfter) ? retryAfter * 1000 : 30_000 * 2 ** attempt;
            console.log(`    rate limited — backing off ${Math.round(backoff / 1000)}s`);
            await response.body?.cancel();
            await delay(backoff);
            continue;
        }
        if (!response.ok) {
            throw new Error(
                `Limitless API ${response.status} for ${path}: ${await response.text()}`,
            );
        }
        return (await response.json()) as T;
    }
}

interface ApiTournamentSummary {
    id: string;
    game: string;
    format: string;
    name: string;
    date: string;
    players: number;
}

interface ApiTournamentDetails extends ApiTournamentSummary {
    decklists: boolean;
    isPublic?: boolean;
    organizer?: { id: number; name: string };
}

interface ApiStandingEntry {
    placing: number;
    name?: string;
    player?: string;
    country?: string;
    record?: { wins: number; losses: number; ties: number };
    drop?: number;
    decklist?: {
        id: string;
        name: string;
        item?: string;
        ability?: string;
        attacks?: string[];
        nature?: string;
    }[];
}

function normalizeTeam(decklist: ApiStandingEntry["decklist"]): TournamentTeamSlot[] | null {
    if (!decklist || decklist.length === 0) return null;
    const team = decklist.map((slot) => ({
        id: slot.id || toID(slot.name ?? ""),
        name: slot.name ?? slot.id ?? "?",
        item: slot.item ?? null,
        ability: slot.ability ?? null,
        moves: (slot.attacks ?? []).filter(Boolean),
        nature: slot.nature ?? null,
    }));
    return team.every((slot) => slot.id) ? team : null;
}

async function fetchEvent(
    summary: ApiTournamentSummary,
    regulationId: string,
): Promise<CachedTournament | null> {
    const details = await api<ApiTournamentDetails>(`/tournaments/${summary.id}/details`);
    if (!details.decklists) {
        console.log(`    skip (no public decklists): ${summary.name}`);
        return null;
    }

    const standings = await api<ApiStandingEntry[]>(`/tournaments/${summary.id}/standings`);
    if (!standings || standings.length === 0) {
        console.log(`    skip (no standings yet): ${summary.name}`);
        return null;
    }

    // Entries without a numeric placing are non-finalized standings (event in
    // progress or abandoned) — never publish those as results.
    const placed = standings
        .filter((entry) => typeof entry.placing === "number")
        .sort((a, b) => a.placing - b.placing);
    if (placed.length === 0) {
        console.log(`    skip (standings not finalized): ${summary.name}`);
        return null;
    }

    const cutSize = summary.players >= 500 ? 16 : 8;
    const topCut: TournamentPlacing[] = [];
    for (const entry of placed.slice(0, cutSize)) {
        const team = normalizeTeam(entry.decklist);
        if (!team) continue; // some players keep lists private even at decklists:true
        topCut.push({
            placing: entry.placing,
            player: entry.name ?? entry.player ?? "Unknown",
            country: entry.country ?? null,
            record: entry.record ?? null,
            team,
        });
    }
    if (topCut.length < Math.min(4, cutSize)) {
        console.log(`    skip (too few public top-cut lists): ${summary.name}`);
        return null;
    }

    const usage = new Map<string, { name: string; count: number }>();
    for (const placing of topCut) {
        for (const slot of placing.team) {
            const existing = usage.get(slot.id);
            if (existing) existing.count += 1;
            else usage.set(slot.id, { name: slot.name, count: 1 });
        }
    }

    return {
        id: summary.id,
        slug: eventSlug(summary.name, summary.date),
        name: summary.name,
        date: summary.date,
        players: summary.players,
        format: summary.format,
        regulationId,
        source: "limitless",
        sourceUrl: `https://play.limitlesstcg.com/tournament/${summary.id}`,
        attribution: LIMITLESS_ATTRIBUTION,
        fetchedAt: new Date().toISOString(),
        topCut,
        topCutUsage: [...usage.entries()]
            .map(([id, { name, count }]) => ({
                id,
                name,
                count,
                pct: (count / topCut.length) * 100,
            }))
            .sort((a, b) => b.count - a.count),
    };
}

async function processRegulation(regulationId: string, formatId: string): Promise<void> {
    console.log(`\n${regulationId} (Limitless format ${formatId})`);
    const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    const dir = join(TOURNAMENT_CACHE_DIR, regulationId);
    mkdirSync(dir, { recursive: true });

    let fetched = 0;
    let skippedCached = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
        const list = await api<ApiTournamentSummary[]>(
            `/tournaments?game=VGC&format=${encodeURIComponent(formatId)}&limit=${PAGE_LIMIT}&page=${page}`,
        );
        if (list.length === 0) break;

        for (const summary of list) {
            if (summary.date > now) continue; // not started
            if (summary.players < MIN_PLAYERS) continue;
            const slug = eventSlug(summary.name, summary.date);
            const outPath = join(dir, `${slug}.json`);
            if (!FORCE && existsSync(outPath)) {
                skippedCached++;
                continue;
            }
            console.log(`  ${summary.date.slice(0, 10)} ${summary.name} (${summary.players}p)`);
            const event = await fetchEvent(summary, regulationId);
            if (event) {
                writeFileSync(outPath, `${JSON.stringify(event, null, 1)}\n`);
                fetched++;
            }
        }

        const oldest = list[list.length - 1];
        if (oldest.date < cutoff) break; // pages are newest-first; past the window
    }
    console.log(`  cached ${fetched} new event(s), ${skippedCached} already cached`);
}

async function main() {
    const targets = REGULATIONS.filter((r) => r.limitlessFormatId);
    if (targets.length === 0) {
        console.warn("No regulation has a limitlessFormatId — nothing to fetch.");
        return;
    }
    for (const regulation of targets) {
        await processRegulation(regulation.id, regulation.limitlessFormatId as string);
    }
    console.log("\nDone.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
