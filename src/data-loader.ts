// Direct imports for Cloudflare Workers (no filesystem access)
import { Pokedex } from './data/pokedex.js';
import { Moves } from './data/moves.js';
import { Learnsets } from './data/learnsets.js';
import { FormatsData } from './data/formats-data.js';
import { Abilities } from './data/abilities.js';
import { Items } from './data/items.js';
import { TypeChart } from './data/typechart.js';

import type {
  PokedexTable,
  MovesTable,
  LearnsetsTable,
  FormatsDataTable,
  AbilitiesTable,
  ItemsTable,
  TypeChartTable,
  PokemonSpecies,
  Move,
  TypeChart as TypeChartType,
} from './types.js';

// Use the imported data directly
const pokedexData = Pokedex as PokedexTable;
const movesData = Moves as MovesTable;
const learnsetsData = Learnsets as LearnsetsTable;
const formatsData = FormatsData as FormatsDataTable;
const abilitiesData = Abilities as AbilitiesTable;
const itemsData = Items as ItemsTable;
const typeChartData = TypeChart as TypeChartTable;

/**
 * Convert a string to a Pokémon Showdown ID format
 */
export function toID(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Get the entire Pokedex table
 */
export function getPokedex(): PokedexTable {
  return pokedexData;
}

/**
 * Get a Pokémon's data by name
 */
export function getPokemon(name: string): PokemonSpecies | undefined {
  const id = toID(name);
  return pokedexData[id];
}

/**
 * Get a move's data by name
 */
export function getMove(name: string): Move | undefined {
  const id = toID(name);
  return movesData[id];
}

/**
 * Get a Pokémon's learnset
 */
export function getPokemonLearnset(name: string) {
  const id = toID(name);
  return learnsetsData[id];
}

/**
 * Get a Pokémon's format data (tier info, etc.)
 */
export function getPokemonFormatData(name: string) {
  const id = toID(name);
  return formatsData[id];
}

/**
 * Get an ability's data by name
 */
export function getAbility(name: string) {
  const id = toID(name);
  return abilitiesData[id];
}

/**
 * Get an item's data by name
 */
export function getItem(name: string) {
  const id = toID(name);
  return itemsData[id];
}

/**
 * Get the type chart
 */
export function getTypeChart(): TypeChartType {
  return typeChartData;
}
