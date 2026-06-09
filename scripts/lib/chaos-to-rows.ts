/**
 * Shared mapper: Smogon "chaos" usage stats -> flat D1 rows.
 *
 * Used by both scripts/backfill-history.ts (historical archive pull) and
 * scripts/append-history.ts (monthly append after fetch-stats). Keeping the
 * chaos -> rows transform in one place guarantees backfilled and ongoing
 * snapshots have identical shape. The normalization mirrors the top-N logic in
 * src/stats.ts (getPopularSets) so D1 set data agrees with the live KV tools.
 */

/** Default provenance for Smogon monthly usage stats. */
export const DEFAULT_SOURCE = "smogon-chaos";

/** Store compact top-N set data only for Pokémon at or above this usage fraction. */
export const SET_JSON_CUTOFF = 0.01; // 1%

export interface MetaSnapshotHeader {
    format: string;
    date: string;
    cutoff: number | null;
    numBattles: number | null;
    totalPokemon: number;
    source: string;
    fetchedAt: string;
}

export interface UsageSnapshotRow {
    format: string;
    date: string;
    source: string;
    pokemonId: string;
    displayName: string;
    usage: number;
    rawCount: number | null;
    rank: number;
    setJson: string | null;
}

/** The object shape returned by smogon's Statistics.process(). */
export interface ChaosSnapshot {
    info: Record<string, any>;
    data: Record<string, any>;
}

export interface ChaosToRowsResult {
    header: MetaSnapshotHeader;
    rows: UsageSnapshotRow[];
}

/** Normalize a display name to its id (matches src/data-loader.ts toID). */
function toID(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Top-N entries of a weighted-count map, as [name, percent] sorted desc. */
function topN(data: Record<string, number> | undefined, n: number): [string, number][] {
    if (!data) return [];
    const total = Object.values(data).reduce((sum, v) => sum + v, 0);
    if (total === 0) return [];
    return Object.entries(data)
        .map(([key, value]) => [key, (value / total) * 100] as [string, number])
        .sort(([, a], [, b]) => b - a)
        .slice(0, n);
}

/** Compact, query-friendly top-N set summary for a single Pokémon. */
function buildSetJson(entry: Record<string, any>): string {
    const tera = topN(entry["Tera Types"], 8)
        .filter(([type]) => type.toLowerCase() !== "nothing")
        .slice(0, 5);
    return JSON.stringify({
        abilities: topN(entry.Abilities, 3),
        items: topN(entry.Items, 5),
        moves: topN(entry.Moves, 8),
        tera,
        teammates: topN(entry.Teammates, 6),
    });
}

/**
 * Map one Smogon chaos snapshot to a header + per-Pokémon rows. Pokémon are
 * ranked by usage descending; set_json is populated only for mons >= cutoff.
 */
export function chaosToRows(
    format: string,
    date: string,
    chaos: ChaosSnapshot,
    options: { source?: string; fetchedAt?: string } = {},
): ChaosToRowsResult {
    const source = options.source ?? DEFAULT_SOURCE;
    const fetchedAt = options.fetchedAt ?? new Date().toISOString();

    const entries = Object.entries(chaos.data ?? {})
        .map(([name, entry]) => ({
            name,
            entry: entry as Record<string, any>,
            usage: typeof (entry as any).usage === "number" ? (entry as any).usage : 0,
        }))
        .sort((a, b) => b.usage - a.usage);

    const rows: UsageSnapshotRow[] = entries.map((e, i) => {
        const rawCount = e.entry["Raw count"];
        return {
            format,
            date,
            source,
            pokemonId: toID(e.name),
            displayName: e.name,
            usage: e.usage,
            rawCount: typeof rawCount === "number" ? Math.round(rawCount) : null,
            rank: i + 1,
            setJson: e.usage >= SET_JSON_CUTOFF ? buildSetJson(e.entry) : null,
        };
    });

    const info = chaos.info ?? {};
    const header: MetaSnapshotHeader = {
        format,
        date,
        cutoff: typeof info.cutoff === "number" ? info.cutoff : null,
        numBattles:
            typeof info["number of battles"] === "number" ? info["number of battles"] : null,
        totalPokemon: rows.length,
        source,
        fetchedAt,
    };

    return { header, rows };
}
