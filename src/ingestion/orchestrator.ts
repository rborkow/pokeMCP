import { chunkStrategyDocument } from "./chunker.js";
import { generateEmbeddings } from "./embedder.js";
import { indexChunks } from "./indexer.js";
import { scrapeWithDelay } from "./scraper.js";

// Singles formats (stable, rarely change)
const SINGLES_FORMATS = [
    // Gen 9 Singles
    "gen9ou",
    "gen9ubers",
    "gen9uu",
    "gen9ru",
    "gen9nu",
    "gen9pu",
    "gen9lc",
    // Gen 8 Singles
    "gen8ou",
    "gen8ubers",
    "gen8uu",
    "gen8ru",
    "gen8nu",
    "gen8pu",
    "gen8lc",
    // Gen 7 Singles
    "gen7ou",
    "gen7ubers",
    "gen7uu",
    "gen7ru",
    "gen7nu",
    "gen7pu",
    "gen7lc",
];

// Default VGC/doubles formats (used when KV discovery data is unavailable)
const DEFAULT_VGC_FORMATS = [
    "gen9vgc2026regf",
    "gen9vgc2025regi",
    "gen9vgc2024regh",
    "gen9doublesou",
];

/**
 * Load formats for ingestion, using discovered VGC formats from KV when available.
 * The discovery script (scripts/discover-formats.ts) writes to KV via upload-stats.sh.
 */
export async function getIngestionFormats(env: Env): Promise<string[]> {
    try {
        const discovered = (await env.POKEMON_STATS.get("_discovered_formats", "json")) as {
            vgcFormats?: string[];
            doublesFormats?: string[];
        } | null;
        if (discovered?.vgcFormats && discovered.vgcFormats.length > 0) {
            const vgcFormats = [
                ...(discovered.vgcFormats || []),
                ...(discovered.doublesFormats || []),
            ];
            console.log(`Loaded ${vgcFormats.length} VGC/doubles formats from discovery`);
            return [...SINGLES_FORMATS, ...vgcFormats];
        }
    } catch (e) {
        console.warn("Failed to load discovered formats from KV:", e);
    }
    console.log("Using default VGC format list");
    return [...SINGLES_FORMATS, ...DEFAULT_VGC_FORMATS];
}

/**
 * Get the top 50 Pokemon for a format from the usage-stats index in KV.
 * Returns [] when no index exists; throws on KV errors so the coordinator's
 * retry policy can handle transient failures.
 */
export async function getTopPokemon(format: string, env: Env): Promise<string[]> {
    const index = (await env.POKEMON_STATS.get(`${format}:_index`, "json")) as {
        pokemon: Record<string, number>;
        version: number;
    } | null;

    if (!index || index.version !== 2) {
        console.warn(`No stats index found for ${format}`);
        return [];
    }

    const top = Object.entries(index.pokemon)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 50)
        .map(([name]) => name);
    console.log(`Found ${top.length} Pokemon for ${format}`);
    return top;
}

export interface FormatIngestionCounts {
    pokemonProcessed: number;
    chunksIndexed: number;
    errors: number;
}

/**
 * Ingest a list of Pokemon for one format: scrape, chunk, embed, index.
 * Per-Pokemon failures are logged and counted but never abort the format.
 */
export async function ingestFormat(
    format: string,
    pokemon: string[],
    env: Env,
): Promise<FormatIngestionCounts> {
    console.log(`=== Ingesting format: ${format} (${pokemon.length} Pokemon) ===`);

    const counts: FormatIngestionCounts = {
        pokemonProcessed: 0,
        chunksIndexed: 0,
        errors: 0,
    };

    for (const p of pokemon) {
        try {
            const chunksIndexed = await processPokemon(p, format, env);
            if (chunksIndexed !== null) {
                counts.pokemonProcessed++;
                counts.chunksIndexed += chunksIndexed;
            }
        } catch (error) {
            console.error(`Failed to process ${p} in ${format}:`, error);
            counts.errors++;
        }
    }

    console.log(
        `=== ${format} done: ${counts.pokemonProcessed} Pokemon, ` +
            `${counts.chunksIndexed} chunks, ${counts.errors} errors ===`,
    );
    return counts;
}

/**
 * Process a single Pokemon in a format.
 * Returns the number of chunks indexed, or null when no content was found.
 */
async function processPokemon(pokemon: string, format: string, env: Env): Promise<number | null> {
    console.log(`Processing ${pokemon}...`);

    // Step 1: Scrape
    const doc = await scrapeWithDelay(pokemon, format, 500);
    if (!doc) {
        console.warn(`Skipping ${pokemon} - no content found`);
        return null;
    }

    // Step 2: Chunk
    const chunks = chunkStrategyDocument(doc);
    console.log(`  Created ${chunks.length} chunks`);

    // Step 3: Embed
    const embedded = await generateEmbeddings(chunks, env);
    console.log(`  Generated ${embedded.length} embeddings`);

    // Step 4: Index
    await indexChunks(embedded, env);
    console.log(`  Indexed ${embedded.length} vectors`);

    return embedded.length;
}
