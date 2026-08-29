/**
 * R2 interaction-log digest.
 *
 * pokeMCP writes a 10% anonymized sample of tool interactions to the
 * `pokemcp-interaction-logs` bucket under `logs/YYYY/MM/DD/HH/{uuid}.json`
 * (schema: pokeMCP src/logging.ts `InteractionLog`). We read the report day's
 * objects, aggregate the most-mentioned Pokémon / formats, and keep a few
 * example interactions to give the Claude call qualitative "what are people
 * actually asking" signal beyond the structured tool counts.
 */

import type { DateWindow, InteractionSample, QueryAnalytics } from "../types";

interface InteractionLog {
    id: string;
    timestamp: number;
    tool: string;
    args: Record<string, unknown>;
    response: string;
    responseTimeMs: number;
    success: boolean;
    format?: string;
    pokemonMentioned?: string[];
}

/** Cap objects read to bound R2 GET volume on busy days. */
const MAX_OBJECTS = 1500;
const MAX_EXAMPLES = 25;

export async function getInteractionDigest(
    env: Env,
    window: DateWindow,
): Promise<QueryAnalytics["sampled"]> {
    if (!env.INTERACTION_LOGS) {
        console.warn("[Logs] INTERACTION_LOGS bucket not bound — skipping digest");
        return null;
    }

    const prefix = dayPrefix(window.day);
    const keys = await listKeys(env.INTERACTION_LOGS, prefix, MAX_OBJECTS);
    if (keys.length === 0)
        return { sampleSize: 0, topPokemon: [], topFormats: [], exampleQueries: [] };

    const pokemon = new Map<string, number>();
    const formats = new Map<string, number>();
    const examples: InteractionSample[] = [];
    let sampleSize = 0;

    for (const key of keys) {
        const obj = await env.INTERACTION_LOGS.get(key);
        if (!obj) continue;
        let log: InteractionLog;
        try {
            log = (await obj.json()) as InteractionLog;
        } catch {
            continue;
        }
        sampleSize++;

        for (const name of log.pokemonMentioned ?? []) {
            pokemon.set(name, (pokemon.get(name) ?? 0) + 1);
        }
        if (log.format) formats.set(log.format, (formats.get(log.format) ?? 0) + 1);

        if (examples.length < MAX_EXAMPLES) {
            examples.push({
                tool: log.tool,
                format: log.format,
                pokemon: (log.pokemonMentioned ?? []).slice(0, 6),
                success: log.success,
            });
        }
    }

    return {
        sampleSize,
        topPokemon: topN(pokemon, 15).map(([name, count]) => ({ name, count })),
        topFormats: topN(formats, 10).map(([format, count]) => ({ format, count })),
        exampleQueries: examples,
    };
}

function dayPrefix(day: string): string {
    // day is "YYYY-MM-DD"; the bucket layout is logs/YYYY/MM/DD/
    return `logs/${day.replace(/-/g, "/")}/`;
}

async function listKeys(bucket: R2Bucket, prefix: string, limit: number): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
        const page = await bucket.list({ prefix, cursor, limit: 1000 });
        for (const o of page.objects) {
            keys.push(o.key);
            if (keys.length >= limit) return keys;
        }
        cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return keys;
}

function topN(counts: Map<string, number>, n: number): Array<[string, number]> {
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}
