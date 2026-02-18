import type { EmbeddedChunk } from "./types.js";

/**
 * Index embedded chunks into Vectorize and KV
 */
export async function indexChunks(chunks: EmbeddedChunk[], env: Env): Promise<void> {
    console.log(`Indexing ${chunks.length} chunks...`);

    // Store vectors in Vectorize
    await upsertVectors(chunks, env.VECTOR_INDEX);

    // Store full content in KV
    await storeDocuments(chunks, env.STRATEGY_DOCS);

    console.log(`Successfully indexed ${chunks.length} chunks`);
}

/**
 * Upsert vectors to Vectorize
 */
async function upsertVectors(chunks: EmbeddedChunk[], index: VectorizeIndex): Promise<void> {
    const batchSize = 100;

    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        const vectors = batch.map((chunk) => ({
            id: chunk.id,
            values: chunk.embedding,
            metadata: {
                pokemon: chunk.metadata.pokemon,
                format: chunk.metadata.format,
                section_type: chunk.metadata.section_type,
                set_name: chunk.metadata.set_name || "",
                source_url: chunk.metadata.source_url,
                timestamp: chunk.metadata.timestamp,
            },
        }));

        try {
            await index.upsert(vectors);
            console.log(
                `Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} to Vectorize`,
            );
        } catch (error) {
            console.error(`Failed to upsert vectors at batch ${i}:`, error);
            throw error;
        }
    }
}

/**
 * Store full document content in KV
 */
async function storeDocuments(chunks: EmbeddedChunk[], kv: KVNamespace): Promise<void> {
    const promises = chunks.map((chunk) =>
        kv.put(
            chunk.id,
            JSON.stringify({
                content: chunk.content,
                metadata: chunk.metadata,
            }),
            {
                expirationTtl: 60 * 60 * 24 * 180, // 180 days
            },
        ),
    );

    await Promise.all(promises);
    console.log(`Stored ${chunks.length} documents in KV`);
}

/**
 * Delete chunks for a specific Pokemon/format combination
 */
export async function deleteChunks(pokemon: string, format: string, env: Env): Promise<void> {
    // Note: Vectorize doesn't support bulk delete by metadata,
    // so we'd need to track IDs separately if we want to clean up old data
    console.log(`Cleanup for ${pokemon} in ${format} not yet implemented`);
}
