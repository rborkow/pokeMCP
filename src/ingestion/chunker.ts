import type { StrategyDocument, DocumentChunk, ChunkingOptions } from "./types.js";

/**
 * Chunk a strategy document into smaller pieces for embedding
 */
export function chunkStrategyDocument(doc: StrategyDocument): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    for (const section of doc.sections) {
        const sectionChunks = chunkSection(section, doc, chunkIndex);
        chunks.push(...sectionChunks);
        chunkIndex += sectionChunks.length;
    }

    // Update total_chunks for all chunks
    for (const chunk of chunks) {
        chunk.metadata.total_chunks = chunks.length;
    }

    return chunks;
}

/**
 * Chunk a single section
 */
function chunkSection(section: any, doc: StrategyDocument, startIndex: number): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    // For moveset sections, keep each set as a single chunk if reasonable size
    if (section.type === "moveset") {
        const content = enrichContent(section.content, doc.pokemon, section.setName);

        if (estimateTokens(content) <= 600) {
            chunks.push(createChunk(content, section, doc, startIndex));
        } else {
            // If too large, split it
            const splitChunks = splitLargeContent(content, 500);
            for (let i = 0; i < splitChunks.length; i++) {
                chunks.push(createChunk(splitChunks[i], section, doc, startIndex + i));
            }
        }
    }
    // For overview and counter sections, split if needed
    else {
        const content = enrichContent(section.content, doc.pokemon);
        const maxTokens = section.type === "overview" ? 800 : 600;

        if (estimateTokens(content) <= maxTokens) {
            chunks.push(createChunk(content, section, doc, startIndex));
        } else {
            const splitChunks = splitLargeContent(content, maxTokens - 100);
            for (let i = 0; i < splitChunks.length; i++) {
                chunks.push(createChunk(splitChunks[i], section, doc, startIndex + i));
            }
        }
    }

    return chunks;
}

/**
 * Create a document chunk
 */
function createChunk(
    content: string,
    section: any,
    doc: StrategyDocument,
    index: number,
): DocumentChunk {
    return {
        id: generateChunkId(doc.pokemon, doc.format, section.type, index),
        content,
        metadata: {
            pokemon: doc.pokemon,
            format: doc.format,
            section_type: section.type,
            set_name: section.setName,
            source_url: doc.url,
            chunk_index: index,
            total_chunks: 0, // Will be updated later
            timestamp: doc.fetchedAt,
        },
    };
}

/**
 * Enrich content with context
 */
function enrichContent(content: string, pokemon: string, setName?: string): string {
    let enriched = content;

    // Add Pokemon name if not already mentioned prominently at the start
    if (!content.toLowerCase().startsWith(pokemon.toLowerCase())) {
        if (setName) {
            enriched = `${pokemon} - ${setName}: ${content}`;
        } else {
            enriched = `${pokemon}: ${content}`;
        }
    }

    return enriched;
}

/**
 * Split large content into smaller chunks
 */
function splitLargeContent(content: string, maxTokens: number): string[] {
    const chunks: string[] = [];
    const sentences = content.split(/(?<=[.!?])\s+/);

    let currentChunk = "";
    let currentTokens = 0;

    for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);

        if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = sentence;
            currentTokens = sentenceTokens;
        } else {
            currentChunk += (currentChunk ? " " : "") + sentence;
            currentTokens += sentenceTokens;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [content];
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Generate a unique chunk ID
 */
function generateChunkId(
    pokemon: string,
    format: string,
    sectionType: string,
    index: number,
): string {
    const normalized = `${pokemon.toLowerCase()}-${format}-${sectionType}-${index}`;
    return normalized.replace(/[^a-z0-9-]/g, "");
}
