/**
 * Types for the content ingestion pipeline
 */

export type SectionType = 'overview' | 'moveset' | 'counters' | 'teammates';

export interface StrategySection {
  type: SectionType;
  title: string;
  content: string;
  setName?: string; // For moveset sections
}

export interface StrategyDocument {
  pokemon: string;
  format: string;
  url: string;
  fetchedAt: string;
  sections: StrategySection[];
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  pokemon: string;
  format: string;
  section_type: SectionType;
  set_name?: string;
  source_url: string;
  chunk_index: number;
  total_chunks: number;
  timestamp: string;
}

export interface EmbeddedChunk extends DocumentChunk {
  embedding: number[];
}

export interface ChunkingOptions {
  maxTokens: number;
  overlap: number;
  preserveContext: boolean;
}

export interface IngestionStats {
  pokemonProcessed: number;
  documentsScraped: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  vectorsIndexed: number;
  errors: number;
  startTime: string;
  endTime?: string;
}
