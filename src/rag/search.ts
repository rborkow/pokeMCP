import type { VectorMatch, SearchResult, QueryOptions } from "./types.js";

/**
 * Execute a vector similarity search with filters
 */
export async function vectorSearch(
    queryEmbedding: number[],
    options: QueryOptions,
    env: Env,
): Promise<VectorMatch[]> {
    const { format, pokemon, sectionType, limit = 10 } = options;

    // Build metadata filter
    const filter: Record<string, string> = {};
    if (format) filter.format = format;
    if (pokemon) filter.pokemon = pokemon.toLowerCase();
    if (sectionType) filter.section_type = sectionType;

    try {
        const queryOptions = {
            topK: limit * 2, // Get more results for reranking
            filter: Object.keys(filter).length > 0 ? filter : undefined,
            returnMetadata: "all" as const,
        };

        const results = await env.VECTOR_INDEX.query(queryEmbedding, queryOptions);
        console.log(`Found ${results.matches.length} vector matches`);

        return results.matches.map((match) => ({
            id: match.id,
            score: match.score,
            metadata: {
                pokemon: match.metadata?.pokemon as string,
                format: match.metadata?.format as string,
                section_type: match.metadata?.section_type as string,
                set_name: match.metadata?.set_name as string | undefined,
                source_url: match.metadata?.source_url as string,
                timestamp: match.metadata?.timestamp as string,
            },
        }));
    } catch (error) {
        console.error("Vectorize query failed:", error);
        throw new Error(
            `Vector search failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Enrich vector matches with full content from KV
 */
export async function enrichWithContent(matches: VectorMatch[], env: Env): Promise<SearchResult[]> {
    const results = await Promise.allSettled(
        matches.map((match) => env.STRATEGY_DOCS.get(match.id, "json")),
    );

    const enriched: SearchResult[] = [];
    for (let i = 0; i < matches.length; i++) {
        const result = results[i];
        if (result.status !== "fulfilled" || !result.value || typeof result.value !== "object") {
            continue;
        }
        const data = result.value as any;
        enriched.push({
            id: matches[i].id,
            content: data.content || "",
            score: matches[i].score,
            metadata: {
                ...matches[i].metadata,
                chunk_index: data.metadata?.chunk_index || 0,
                total_chunks: data.metadata?.total_chunks || 1,
            },
        });
    }

    console.log(`Enriched ${enriched.length}/${matches.length} results`);
    return enriched;
}

/**
 * Execute full search pipeline: vector search + content enrichment
 */
export async function executeSearch(
    queryEmbedding: number[],
    options: QueryOptions,
    env: Env,
): Promise<SearchResult[]> {
    // Step 1: Vector similarity search
    const matches = await vectorSearch(queryEmbedding, options, env);

    if (matches.length === 0) {
        console.log("No vector matches found");
        return [];
    }

    // Step 2: Enrich with full content from KV
    const enriched = await enrichWithContent(matches, env);

    return enriched;
}
