import eventsIndex from "@/data/events/index.json";

/**
 * Tournament recap page data, written by scripts/generate-reports.ts from the
 * Limitless cache (src/cached-tournaments/). One JSON per event under
 * src/data/events/{slug}/{event-slug}.json, indexed by index.json.
 */
export interface EventTeamSlot {
    id: string;
    name: string;
    item: string | null;
    ability: string | null;
    moves: string[];
    nature: string | null;
}

export interface EventPlacing {
    placing: number;
    player: string;
    country: string | null;
    record: { wins: number; losses: number; ties: number } | null;
    team: EventTeamSlot[];
}

export interface EventUsageRow {
    id: string;
    name: string;
    count: number;
    pct: number;
    /** Ladder usage fraction at generation time; null if below the mon-page cutoff. */
    ladderUsage: number | null;
}

export interface EventPageData {
    slug: string;
    name: string;
    date: string;
    players: number;
    format: string;
    regulationLabel: string;
    source: string;
    sourceUrl: string;
    attribution: string;
    topCut: EventPlacing[];
    topCutUsage: { id: string; name: string; count: number; pct: number }[];
    usageComparison: EventUsageRow[];
}

export interface EventIndexEntry {
    slug: string;
    name: string;
    date: string;
    players: number;
    format: string;
    regulationLabel: string;
}

export function getEventsIndex(): Record<string, EventIndexEntry[]> {
    return eventsIndex as Record<string, EventIndexEntry[]>;
}

export function getEventParams(): { slug: string; event: string }[] {
    return Object.entries(getEventsIndex()).flatMap(([slug, events]) =>
        events.map((event) => ({ slug, event: event.slug })),
    );
}

export function hasEventPage(slug: string, eventSlug: string): boolean {
    return getEventsIndex()[slug]?.some((event) => event.slug === eventSlug) ?? false;
}
