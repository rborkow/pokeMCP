/**
 * Compare a fetched stats file with the `{format}:_index` value read back from
 * KV. Returns a description of the problem, or null when the index describes
 * the same snapshot. Pure, so it is unit-tested without touching KV.
 */

interface FetchedStats {
    date?: string;
    data?: { info?: Record<string, unknown>; data?: Record<string, unknown> };
}

export function checkIndex(
    format: string,
    fetched: FetchedStats,
    kvValue: string | null,
): string | null {
    const info = fetched.data?.info;
    const pokemon = fetched.data?.data;
    if (!info || !pokemon) return `the fetched file for ${format} has no usable data`;

    if (!kvValue) return `KV has no ${format}:_index — the upload did not take effect`;

    let index: {
        version?: number;
        info?: Record<string, unknown>;
        pokemon?: Record<string, unknown>;
    };
    try {
        index = JSON.parse(kvValue);
    } catch {
        return `KV ${format}:_index is not valid JSON`;
    }
    if (index.version !== 2 || !index.info || !index.pokemon) {
        return `KV ${format}:_index is not a version 2 index`;
    }

    const fetchedBattles = info["number of battles"];
    const liveBattles = index.info["number of battles"];
    if (liveBattles !== fetchedBattles) {
        return (
            `KV ${format}:_index is stale: it records ${liveBattles} battles, ` +
            `the ${fetched.date ?? "fetched"} snapshot has ${fetchedBattles}`
        );
    }

    const fetchedCount = Object.keys(pokemon).length;
    const liveCount = Object.keys(index.pokemon).length;
    if (liveCount !== fetchedCount) {
        return `KV ${format}:_index lists ${liveCount} Pokémon, the snapshot has ${fetchedCount}`;
    }
    return null;
}
