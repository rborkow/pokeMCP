"use client";

import { useMemo } from "react";
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
	const shouldFetch = enabled && pokemonName.length > 2;

	// Fetch Pokemon data for abilities
	const { data: lookupData, isLoading: isLookupLoading } = usePokemonLookup(
		pokemonName,
		shouldFetch,
	);

	// Fetch popular sets for moves, items, tera types
	const { data: setsData, isLoading: isSetsLoading } = usePopularSets(
		pokemonName,
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
