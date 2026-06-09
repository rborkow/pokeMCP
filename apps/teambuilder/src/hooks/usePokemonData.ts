"use client";

import { useMemo } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { COMMON_ITEMS } from "@/lib/data/items";
import { usePokemonLookup, usePopularSets } from "@/lib/mcp-client";
import { parseAbilities, parseItems, parseMoves } from "@/lib/pokemon-parser";

interface UsePokemonDataReturn {
    validAbilities: string[];
    popularMoves: string[];
    popularItems: string[];
    isLoading: boolean;
}

/**
 * Custom hook that handles data fetching and parsing for the Pokemon edit dialog.
 * Takes pokemon name, format, and enabled flag as parameters.
 * Uses usePokemonLookup and usePopularSets from mcp-client.
 */
export function usePokemonData(
    pokemonName: string,
    format: string,
    enabled: boolean,
): UsePokemonDataReturn {
    // Debounce the typed name so each keystroke doesn't fire a lookup +
    // popular-sets pair. This both cuts redundant requests/subrequests and
    // stops partial names ("gya", "gyar", ...) from inflating usage metrics.
    const debouncedName = useDebouncedValue(pokemonName.trim(), 300);
    const shouldFetch = enabled && debouncedName.length > 2;

    // Fetch Pokemon data for abilities
    const { data: lookupData, isLoading: isLookupLoading } = usePokemonLookup(
        debouncedName,
        shouldFetch,
    );

    // Fetch popular sets for moves, items, tera types
    const { data: setsData, isLoading: isSetsLoading } = usePopularSets(
        debouncedName,
        format,
        shouldFetch,
    );

    // Parse abilities from lookup response
    const validAbilities = useMemo(() => {
        if (!lookupData || typeof lookupData !== "string") return [];
        return parseAbilities(lookupData);
    }, [lookupData]);

    // Parse moves and items from popular sets
    const { popularMoves, popularItems } = useMemo(() => {
        if (!setsData || typeof setsData !== "string") {
            return { popularMoves: [], popularItems: [] };
        }
        return {
            popularMoves: parseMoves(setsData),
            popularItems: parseItems(setsData),
        };
    }, [setsData]);

    // Combine popular items with common items list (not currently used in UI but kept for future)
    useMemo(() => {
        const itemSet = new Set([...popularItems, ...COMMON_ITEMS]);
        return Array.from(itemSet);
    }, [popularItems]);

    return {
        validAbilities,
        popularMoves,
        popularItems,
        isLoading: isLookupLoading || isSetsLoading,
    };
}
