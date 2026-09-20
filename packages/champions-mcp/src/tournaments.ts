import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/** Root-repo cache written by `bun run fetch-tournaments` (scripts/fetch-tournaments.ts). */
export const TOURNAMENT_DIR = join(here, "..", "..", "..", "src", "cached-tournaments");

export interface Slot {
    id: string;
    name: string;
    item: string | null;
    ability: string | null;
    moves: string[];
    nature: string | null;
}

export interface Placing {
    placing: number;
    player: string;
    country: string | null;
    record: { wins: number; losses: number; ties: number } | null;
    team: Slot[];
}

export interface Event {
    id: string;
    slug: string;
    name: string;
    date: string;
    players: number;
    regulationId: string;
    sourceUrl: string;
    topCut: Placing[];
    topCutUsage: { id: string; name: string; count: number; pct: number }[];
}

/** Load cached tournament events for a regulation, newest first; [] when the cache is missing. */
export function loadEvents(regulationId = "champions-regmc"): Event[] {
    const dir = join(TOURNAMENT_DIR, regulationId);
    if (!existsSync(dir)) return [];
    const events: Event[] = [];
    for (const f of readdirSync(dir)) {
        if (!f.endsWith(".json")) continue;
        try {
            events.push(JSON.parse(readFileSync(join(dir, f), "utf-8")) as Event);
        } catch {
            // a corrupt cache file must not sink the whole listing
        }
    }
    return events.sort((a, b) => b.date.localeCompare(a.date));
}

/** Showdown paste form for one team slot, nulls omitted. No Stat Points: Limitless open team sheets omit spreads. */
export function slotToPaste(s: Slot): string {
    const lines = [s.item ? `${s.name} @ ${s.item}` : s.name];
    if (s.ability) lines.push(`Ability: ${s.ability}`);
    if (s.nature) lines.push(`${s.nature} Nature`);
    for (const m of s.moves) lines.push(`- ${m}`);
    return lines.join("\n");
}

/** Aggregate top-cut appearances across events (share of top-cut teams carrying each species). */
export function aggregateUsage(events: Event[]): { name: string; teams: number; pct: number }[] {
    const counts = new Map<string, number>();
    let totalTeams = 0;
    for (const e of events) {
        for (const p of e.topCut) {
            totalTeams++;
            for (const name of new Set(p.team.map((s) => s.name))) {
                counts.set(name, (counts.get(name) ?? 0) + 1);
            }
        }
    }
    return [...counts.entries()]
        .map(([name, teams]) => ({
            name,
            teams,
            pct: totalTeams ? Math.round((teams / totalTeams) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.teams - a.teams || a.name.localeCompare(b.name));
}
