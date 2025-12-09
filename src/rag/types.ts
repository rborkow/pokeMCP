import type { SectionType } from '../ingestion/types.js';

/**
 * Query options for semantic search
 */
export interface QueryOptions {
  query: string;
  format?: string;
  pokemon?: string;
  sectionType?: SectionType;
  limit?: number;
  minScore?: number;
}

/**
 * Vector search result from Vectorize
 */
export interface VectorMatch {
  id: string;
  score: number;
  metadata: {
    pokemon: string;
    format: string;
    section_type: string;
    set_name?: string;
    source_url: string;
    timestamp: string;
  };
}

/**
 * Enriched search result with full content
 */
export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: {
    pokemon: string;
    format: string;
    section_type: string;
    set_name?: string;
    source_url: string;
    timestamp: string;
    chunk_index: number;
    total_chunks: number;
  };
}

/**
 * Reranked result with boosted score
 */
export interface RankedResult extends SearchResult {
  finalScore: number;
  boosts: {
    formatMatch?: number;
    pokemonMatch?: number;
    recency?: number;
  };
}

/**
 * Formatted result for MCP output
 */
export interface FormattedResult {
  pokemon: string;
  format: string;
  sectionType: string;
  setName?: string;
  content: string;
  sourceUrl: string;
  relevanceScore: number;
}

/**
 * Query response
 */
export interface QueryResponse {
  results: FormattedResult[];
  query: string;
  totalResults: number;
  processingTimeMs: number;
}
