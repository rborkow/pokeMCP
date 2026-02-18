// Direct imports for Cloudflare Workers (no filesystem access)

import { Abilities } from "./data/abilities.js";
import { FormatsData } from "./data/formats-data.js";
import { Items } from "./data/items.js";
import { Learnsets } from "./data/learnsets.js";
import { Moves } from "./data/moves.js";
import { Pokedex } from "./data/pokedex.js";
import { TypeChart } from "./data/typechart.js";

import type {
    AbilitiesTable,
    FormatsDataTable,
    ItemsTable,
    LearnsetsTable,
    Move,
    MovesTable,
    PokedexTable,
    PokemonSpecies,
    TypeChartTable,
    TypeChart as TypeChartType,
} from "./types.js";

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
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
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

/**
 * Get all Pokemon names from the bundled Pokedex.
 * Filters out non-real Pokemon (MissingNo num=0, CAP Pokemon num<0).
 */
export function getAllPokemonNames(): string[] {
    return Object.values(pokedexData)
        .filter((species) => species.num > 0)
        .map((species) => species.name);
}

// Pre-compute sorted by length descending so "Great Tusk" matches before "Tusk"
const ALL_POKEMON_NAMES: string[] = getAllPokemonNames().sort((a, b) => b.length - a.length);

/**
 * Detect Pokemon names mentioned in a message string.
 * Names are checked longest-first to avoid substring issues
 * (e.g., "Great Tusk" matches before "Tusk").
 */
export function detectPokemonMentions(message: string, limit = 3): string[] {
    const messageLower = message.toLowerCase();
    const found: string[] = [];
    for (const name of ALL_POKEMON_NAMES) {
        if (found.length >= limit) break;
        if (messageLower.includes(name.toLowerCase())) {
            found.push(name);
        }
    }
    return found;
}
