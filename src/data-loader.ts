import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type {
  PokedexTable,
  MovesTable,
  LearnsetsTable,
  FormatsDataTable,
  AbilitiesTable,
  ItemsTable,
  TypeChartTable,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for loaded data
let pokedexCache: PokedexTable | null = null;
let movesCache: MovesTable | null = null;
let learnsetsCache: LearnsetsTable | null = null;
let formatsCache: FormatsDataTable | null = null;
let abilitiesCache: AbilitiesTable | null = null;
let itemsCache: ItemsTable | null = null;
let typeChartCache: TypeChartTable | null = null;

/**
 * Parse a Pokémon Showdown data file by extracting and evaluating the exported object
 */
function parseDataFile<T>(filename: string): T {
  const filepath = join(__dirname, 'data', filename);
  const content = readFileSync(filepath, 'utf-8');

  // Extract the object definition
  // Format: export const Name: Type = { ... };
  const match = content.match(/=\s*(\{[\s\S]*\});?\s*$/);

  if (!match) {
    throw new Error(`Could not parse data file: ${filename}`);
  }

  const objectStr = match[1];

  // Use Function constructor to safely evaluate the object
  // This is safer than eval() but still requires trusted input
  try {
    const fn = new Function(`return ${objectStr}`);
    return fn() as T;
  } catch (error) {
    throw new Error(`Error parsing ${filename}: ${error}`);
  }
}

/**
 * Get Pokédex data
 */
export function getPokedex(): PokedexTable {
  if (!pokedexCache) {
    pokedexCache = parseDataFile<PokedexTable>('pokedex.ts');
  }
  return pokedexCache;
}

/**
 * Get moves data
 */
export function getMoves(): MovesTable {
  if (!movesCache) {
    movesCache = parseDataFile<MovesTable>('moves.ts');
  }
  return movesCache;
}

/**
 * Get learnsets data
 */
export function getLearnsets(): LearnsetsTable {
  if (!learnsetsCache) {
    learnsetsCache = parseDataFile<LearnsetsTable>('learnsets.ts');
  }
  return learnsetsCache;
}

/**
 * Get formats data (tiers)
 */
export function getFormatsData(): FormatsDataTable {
  if (!formatsCache) {
    formatsCache = parseDataFile<FormatsDataTable>('formats-data.ts');
  }
  return formatsCache;
}

/**
 * Get abilities data
 */
export function getAbilities(): AbilitiesTable {
  if (!abilitiesCache) {
    abilitiesCache = parseDataFile<AbilitiesTable>('abilities.ts');
  }
  return abilitiesCache;
}

/**
 * Get items data
 */
export function getItems(): ItemsTable {
  if (!itemsCache) {
    itemsCache = parseDataFile<ItemsTable>('items.ts');
  }
  return itemsCache;
}

/**
 * Get type chart data
 */
export function getTypeChart(): TypeChartTable {
  if (!typeChartCache) {
    typeChartCache = parseDataFile<TypeChartTable>('typechart.ts');
  }
  return typeChartCache;
}

/**
 * Normalize a name to the format used in data files (lowercase, no spaces/special chars)
 */
export function toID(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Get a Pokémon by name
 */
export function getPokemon(name: string) {
  const dex = getPokedex();
  const id = toID(name);
  return dex[id] || null;
}

/**
 * Get a move by name
 */
export function getMove(name: string) {
  const moves = getMoves();
  const id = toID(name);
  return moves[id] || null;
}

/**
 * Get a Pokémon's learnset
 */
export function getPokemonLearnset(name: string) {
  const learnsets = getLearnsets();
  const id = toID(name);
  return learnsets[id] || null;
}

/**
 * Get format data for a Pokémon
 */
export function getPokemonFormatData(name: string) {
  const formats = getFormatsData();
  const id = toID(name);
  return formats[id] || null;
}
