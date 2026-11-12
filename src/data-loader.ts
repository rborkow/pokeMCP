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

// Formes whose learnset is their base species' plus their own additions,
// mirroring Pokémon Showdown's `learnsetParent` special cases.
const FORME_INHERITS_BASE = new Set(["Gastrodon", "Pumpkaboo", "Sinistea", "Tatsugiri"]);

function learnsetParent(species: PokemonSpecies, hasOwnLearnset: boolean) {
    const base =
        species.baseSpecies && species.baseSpecies !== species.name
            ? species.baseSpecies
            : undefined;
    // Megas, Therian formes and other formes without a learnset use the base species'.
    if (!hasOwnLearnset && base) return getPokemon(base);
    if (base && species.forme && FORME_INHERITS_BASE.has(base)) return getPokemon(base);
    if (species.prevo) return getPokemon(species.prevo);
    if (species.changesFrom && species.baseSpecies !== "Kyurem") {
        return getPokemon(species.changesFrom);
    }
    return undefined;
}

/**
 * Every move a Pokémon can know, keyed by move id, with the learn sources
 * (e.g. "9M", "8E") collected from the Pokémon itself, its pre-evolutions and,
 * for formes, the base forme — the same inheritance Pokémon Showdown applies.
 *
 * `getPokemonLearnset` returns only a species' own entry, which omits
 * pre-evolution moves (Incineroar's Fake Out, Kingambit's Sucker Punch) and is
 * empty for most formes. Use this for legality checks.
 *
 * Returns undefined when the Pokémon is unknown or no learnset data exists.
 */
export function getFullLearnset(name: string): Record<string, string[]> | undefined {
    const merged: Record<string, string[]> = {};
    const seen = new Set<string>();
    let found = false;
    let species = getPokemon(name);
    while (species && !seen.has(species.name)) {
        seen.add(species.name);
        const own = learnsetsData[toID(species.name)]?.learnset;
        if (own) {
            found = true;
            for (const [moveId, sources] of Object.entries(own)) {
                merged[moveId] = merged[moveId] ? [...merged[moveId], ...sources] : [...sources];
            }
        }
        species = learnsetParent(species, Boolean(own));
    }
    return found ? merged : undefined;
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
export function getTypeChart(): TypeChartTable {
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
