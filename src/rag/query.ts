import { generateQueryEmbedding } from "../ingestion/embedder.js";
import { executeSearch } from "./search.js";
import { rerankResults, filterByScore } from "./rerank.js";
import { formatResults, formatAsText } from "./format.js";
import type { QueryOptions, QueryResponse } from "./types.js";

/**
 * Main RAG query function - orchestrates the entire pipeline
 */
export async function queryStrategy(options: QueryOptions, env: Env): Promise<QueryResponse> {
    const startTime = Date.now();

    console.log("=== RAG Query Started ===");
    console.log("Query:", options.query);
    console.log("Options:", {
        format: options.format,
        pokemon: options.pokemon,
        limit: options.limit,
    });

    try {
        // Step 1: Generate query embedding
        console.log("Step 1: Generating query embedding...");
        const queryEmbedding = await generateQueryEmbedding(options.query, env);
        console.log("Embedding generated");

        // Step 2: Execute vector search + content enrichment
        console.log("Step 2: Executing vector search...");
        const searchResults = await executeSearch(queryEmbedding, options, env);
        console.log(`Found ${searchResults.length} search results`);

        if (searchResults.length === 0) {
            const processingTime = Date.now() - startTime;
            return {
                results: [],
                query: options.query,
                totalResults: 0,
                processingTimeMs: processingTime,
            };
        }

        // Step 3: Rerank with metadata boosts
        console.log("Step 3: Reranking results...");
        const reranked = rerankResults(searchResults, options);
        console.log(`Reranked to ${reranked.length} results`);

        // Step 4: Filter by minimum score
        const minScore = options.minScore || 0.5;
        const filtered = filterByScore(reranked, minScore);
        console.log(`Filtered to ${filtered.length} results (minScore: ${minScore})`);

        // Step 5: Format results
        const processingTime = Date.now() - startTime;
        const response = formatResults(filtered, options.query, processingTime);

        console.log("=== RAG Query Complete ===");
        console.log(`Returned ${response.totalResults} results in ${processingTime}ms`);

        return response;
    } catch (error) {
        console.error("RAG query failed:", error);
        throw new Error(`Query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Query and return formatted text (for MCP tool)
 */
export async function queryStrategyText(options: QueryOptions, env: Env): Promise<string> {
    const response = await queryStrategy(options, env);
    return formatAsText(response);
}
