/**
 * Emit batched `INSERT OR REPLACE` SQL for D1 from chaos-to-rows output.
 *
 * Mirrors the "generate an artifact, then let wrangler load it" pattern used by
 * scripts/upload-stats.ts for KV — the scripts stay free of Cloudflare auth and
 * runtime concerns; `wrangler d1 execute --file` does the actual write.
 */
import type { ChaosToRowsResult, UsageSnapshotRow } from "./chaos-to-rows.js";

/** SQLite string literal: wrap in single quotes, escape embedded quotes. */
function str(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function num(value: number | null | undefined): string {
    return value === null || value === undefined || Number.isNaN(value) ? "NULL" : String(value);
}

function snapshotInsert(header: ChaosToRowsResult["header"]): string {
    return (
        "INSERT OR REPLACE INTO meta_snapshot " +
        "(format, date, cutoff, num_battles, total_pokemon, source, fetched_at) VALUES " +
        `(${str(header.format)}, ${str(header.date)}, ${num(header.cutoff)}, ` +
        `${num(header.numBattles)}, ${num(header.totalPokemon)}, ${str(header.source)}, ` +
        `${str(header.fetchedAt)});`
    );
}

const USAGE_COLUMNS =
    "(format, date, source, pokemon_id, display_name, usage, raw_count, rank, set_json)";

function usageTuple(r: UsageSnapshotRow): string {
    return (
        `(${str(r.format)}, ${str(r.date)}, ${str(r.source)}, ${str(r.pokemonId)}, ` +
        `${str(r.displayName)}, ${num(r.usage)}, ${num(r.rawCount)}, ${num(r.rank)}, ` +
        `${r.setJson === null ? "NULL" : str(r.setJson)})`
    );
}

/**
 * Build the full SQL text for one snapshot. Usage rows are grouped into
 * multi-row INSERT statements (batchSize tuples each) to keep statement counts
 * within D1's per-file limits.
 */
export function buildSnapshotSql(result: ChaosToRowsResult, batchSize = 100): string {
    const lines: string[] = [snapshotInsert(result.header)];
    for (let i = 0; i < result.rows.length; i += batchSize) {
        const batch = result.rows.slice(i, i + batchSize);
        const values = batch.map(usageTuple).join(",\n");
        lines.push(`INSERT OR REPLACE INTO usage_snapshot ${USAGE_COLUMNS} VALUES\n${values};`);
    }
    return `${lines.join("\n")}\n`;
}
