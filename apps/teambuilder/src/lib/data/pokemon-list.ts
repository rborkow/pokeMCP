import { POKEMON_DISPLAY_NAMES } from "@/lib/showdown-parser";
import { POKEMON_TYPES } from "./pokemon-data-generated";

// POKEMON_TYPES' inner type isn't exported (the file is auto-generated), so
// we use string[] here. Validation/UI code already treats types as strings.
export interface PokemonListEntry {
    id: string;
    displayName: string;
    types: string[];
}

function capitalize(word: string): string {
    if (!word) return word;
    return word[0].toUpperCase() + word.slice(1);
}

function titleCaseHyphenated(hyphenated: string): string {
    return hyphenated.split("-").map(capitalize).join("-");
}

function buildList(): PokemonListEntry[] {
    // Group POKEMON_TYPES keys by canonical ID (the compact key with no
    // hyphens and no spaces).
    const canonical = new Map<string, { hyphenated?: string; types: string[] }>();

    for (const [key, types] of Object.entries(POKEMON_TYPES) as Array<[string, string[]]>) {
        const compact = key.replace(/[-\s]/g, "").toLowerCase();
        const entry = canonical.get(compact) ?? { types };
        if (key === compact) {
            // The canonical (compact) key — register baseline.
            canonical.set(compact, entry);
            continue;
        }
        if (key.includes("-") && !key.includes(" ")) {
            entry.hyphenated = key;
        }
        canonical.set(compact, entry);
    }

    const list: PokemonListEntry[] = [];
    for (const [id, entry] of canonical.entries()) {
        // Prefer canonical Showdown display names (Tapu Koko, Type: Null, Mr. Mime,
        // Farfetch'd, Jangmo-o, Flabébé, etc.). Fall back to title-cased hyphenated
        // alias, then capitalized compact ID.
        const displayName =
            POKEMON_DISPLAY_NAMES[id] ??
            (entry.hyphenated ? titleCaseHyphenated(entry.hyphenated) : capitalize(id));
        list.push({ id, displayName, types: entry.types });
    }

    list.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return list;
}

export const POKEMON_LIST: readonly PokemonListEntry[] = buildList();
