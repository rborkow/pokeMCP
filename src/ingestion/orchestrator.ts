import { scrapeWithDelay } from './scraper.js';
import { chunkStrategyDocument } from './chunker.js';
import { generateEmbeddings } from './embedder.js';
import { indexChunks } from './indexer.js';
import type { IngestionStats } from './types.js';

const FORMATS = ['gen9ou', 'gen9ubers', 'gen9uu', 'gen9ru', 'gen9vgc2024regf', 'gen9vgc2024regh'];

/**
 * Main ingestion pipeline - scrapes, chunks, embeds, and indexes content
 */
export async function runIngestionPipeline(env: Env): Promise<IngestionStats> {
  const stats: IngestionStats = {
    pokemonProcessed: 0,
    documentsScraped: 0,
    chunksCreated: 0,
    embeddingsGenerated: 0,
    vectorsIndexed: 0,
    errors: 0,
    startTime: new Date().toISOString()
  };

  console.log('Starting content ingestion pipeline...');
  console.log(`Formats: ${FORMATS.join(', ')}`);

  // Get top Pokemon for each format
  const topPokemon = await getTopPokemonByFormat(FORMATS, env);

  for (const format of FORMATS) {
    console.log(`\n=== Processing format: ${format} ===`);

    const pokemon = topPokemon[format] || [];
    console.log(`Top Pokemon (${pokemon.length}): ${pokemon.slice(0, 5).join(', ')}...`);

    for (const p of pokemon) {
      try {
        await processPokemon(p, format, stats, env);
      } catch (error) {
        console.error(`Failed to process ${p} in ${format}:`, error);
        stats.errors++;
      }
    }
  }

  stats.endTime = new Date().toISOString();
  console.log('\n=== Ingestion Complete ===');
  console.log(`Pokemon processed: ${stats.pokemonProcessed}`);
  console.log(`Documents scraped: ${stats.documentsScraped}`);
  console.log(`Chunks created: ${stats.chunksCreated}`);
  console.log(`Embeddings generated: ${stats.embeddingsGenerated}`);
  console.log(`Vectors indexed: ${stats.vectorsIndexed}`);
  console.log(`Errors: ${stats.errors}`);

  return stats;
}

/**
 * Process a single Pokemon in a format
 */
async function processPokemon(
  pokemon: string,
  format: string,
  stats: IngestionStats,
  env: Env
): Promise<void> {
  console.log(`Processing ${pokemon}...`);

  // Step 1: Scrape
  const doc = await scrapeWithDelay(pokemon, format, 500);
  if (!doc) {
    console.warn(`Skipping ${pokemon} - no content found`);
    return;
  }

  stats.documentsScraped++;

  // Step 2: Chunk
  const chunks = chunkStrategyDocument(doc);
  stats.chunksCreated += chunks.length;
  console.log(`  Created ${chunks.length} chunks`);

  // Step 3: Embed
  const embedded = await generateEmbeddings(chunks, env);
  stats.embeddingsGenerated += embedded.length;
  console.log(`  Generated ${embedded.length} embeddings`);

  // Step 4: Index
  await indexChunks(embedded, env);
  stats.vectorsIndexed += embedded.length;
  console.log(`  Indexed ${embedded.length} vectors`);

  stats.pokemonProcessed++;
}

/**
 * Get top Pokemon for each format from usage stats
 */
async function getTopPokemonByFormat(
  formats: string[],
  env: Env
): Promise<Record<string, string[]>> {
  const topPokemon: Record<string, string[]> = {};

  for (const format of formats) {
    try {
      const cached = await env.POKEMON_STATS.get(format, 'json');

      if (cached && typeof cached === 'object' && cached.data) {
        const stats = cached.data;

        // Get top 50 by usage
        const top = Object.entries(stats.data)
          .map(([id, data]: [string, any]) => ({ name: id, usage: data.usage }))
          .sort((a, b) => b.usage - a.usage)
          .slice(0, 50)
          .map(p => p.name);

        topPokemon[format] = top;
        console.log(`Found ${top.length} Pokemon for ${format}`);
      } else {
        console.warn(`No stats found for ${format}`);
        topPokemon[format] = [];
      }
    } catch (error) {
      console.error(`Failed to get stats for ${format}:`, error);
      topPokemon[format] = [];
    }
  }

  return topPokemon;
}

/**
 * Process a subset of Pokemon (for testing)
 */
export async function runTestIngestion(
  pokemon: string[],
  format: string,
  env: Env
): Promise<IngestionStats> {
  const stats: IngestionStats = {
    pokemonProcessed: 0,
    documentsScraped: 0,
    chunksCreated: 0,
    embeddingsGenerated: 0,
    vectorsIndexed: 0,
    errors: 0,
    startTime: new Date().toISOString()
  };

  console.log(`Testing ingestion with ${pokemon.length} Pokemon in ${format}`);

  for (const p of pokemon) {
    try {
      await processPokemon(p, format, stats, env);
    } catch (error) {
      console.error(`Failed to process ${p}:`, error);
      stats.errors++;
    }
  }

  stats.endTime = new Date().toISOString();
  return stats;
}
