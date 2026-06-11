import monsIndex from "@/data/mons/index.json";

/**
 * Per-Pokémon trend page data, written by scripts/generate-reports.ts (repo
 * root) from Smogon monthly chaos statistics. One JSON file per Pokémon per
 * format slug under src/data/mons/{slug}/{id}.json, indexed by index.json.
 */
export interface MonHistoryPoint {
    month: string;
    usage: number;
    rank: number | null;
    raw: number | null;
}

export interface MonCounter {
    name: string;
    score: number;
    koPct: number;
    switchPct: number;
}

/** An exact tournament build (joint set) with provenance, from Limitless top cuts. */
export interface MonBuild {
    item: string | null;
    ability: string | null;
    moves: string[];
    nature: string | null;
    count: number;
    bestPlacing: number;
    bestPlayer: string;
    eventName: string;
    eventSlug: string;
    sourceUrl: string;
}

export interface MonPageData {
    id: string;
    name: string;
    slug: string;
    formatId: string;
    formatLabel: string;
    dataThrough: string;
    history: MonHistoryPoint[];
    abilities: [string, number][];
    items: [string, number][];
    moves: [string, number][];
    spreads: [string, number][];
    teraTypes: [string, number][];
    teammates: [string, number][];
    counters: MonCounter[];
    /** Absent in data generated before reports v2. */
    builds?: MonBuild[];
}

export interface MonsFormatIndex {
    formatId: string;
    formatLabel: string;
    dataThrough: string;
    ids: string[];
}

export function getMonsIndex(): Record<string, MonsFormatIndex> {
    return monsIndex as Record<string, MonsFormatIndex>;
}

export function getMonParams(): { id: string; format: string }[] {
    return Object.entries(getMonsIndex()).flatMap(([slug, formatIndex]) =>
        formatIndex.ids.map((id) => ({ id, format: slug })),
    );
}

export function hasMonPage(slug: string, id: string): boolean {
    return getMonsIndex()[slug]?.ids.includes(id) ?? false;
}
