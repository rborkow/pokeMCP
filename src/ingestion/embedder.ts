import type { DocumentChunk, EmbeddedChunk } from './types.js';

/**
 * Generate embeddings for document chunks using Workers AI
 */
export async function generateEmbeddings(
  chunks: DocumentChunk[],
  env: Env
): Promise<EmbeddedChunk[]> {
  const batchSize = 10; // Workers AI batch limit
  const embeddedChunks: EmbeddedChunk[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    try {
      const embedded = await embedBatch(batch, env);
      embeddedChunks.push(...embedded);

      console.log(`Embedded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
    } catch (error) {
      console.error(`Failed to embed batch starting at index ${i}:`, error);
      // Continue with next batch even if this one fails
    }
  }

  return embeddedChunks;
}

/**
 * Embed a single batch of chunks
 */
async function embedBatch(
  chunks: DocumentChunk[],
  env: Env
): Promise<EmbeddedChunk[]> {
  const texts = chunks.map(c => c.content);

  // Use Workers AI BGE model for embeddings
  const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: texts
  });

  // Handle response format
  const embeddings = Array.isArray(response.data) ? response.data : [response.data];

  if (embeddings.length !== chunks.length) {
    throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
  }

  return chunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i] as number[]
  }));
}

/**
 * Generate a single embedding for a query
 */
export async function generateQueryEmbedding(
  query: string,
  env: Env
): Promise<number[]> {
  const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [query]
  });

  const embeddings = Array.isArray(response.data) ? response.data : [response.data];
  return embeddings[0] as number[];
}
