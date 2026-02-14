"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BaseStats, TeamPokemon } from "@/types/pokemon";

const DEFAULT_POKEMON: TeamPokemon = {
	pokemon: "",
	moves: ["", "", "", ""],
	ability: "",
	item: "",
	nature: "Hardy",
	teraType: "",
	evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
	ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
	level: 100,
};

function getInitialPokemon(pokemon: TeamPokemon | null): TeamPokemon {
	if (!pokemon) return DEFAULT_POKEMON;
	return {
		...DEFAULT_POKEMON,
		...pokemon,
		moves: [...(pokemon.moves || []), "", "", "", ""].slice(0, 4),
		evs: { ...DEFAULT_POKEMON.evs, ...pokemon.evs },
		ivs: { ...DEFAULT_POKEMON.ivs, ...pokemon.ivs },
	};
}

interface UsePokemonEditStateReturn {
	editedPokemon: TeamPokemon;
	updateField: <K extends keyof TeamPokemon>(
		field: K,
		value: TeamPokemon[K],
	) => void;
	updateMove: (index: number, move: string) => void;
	getMoveValue: (index: number) => string;
	updateEV: (stat: keyof BaseStats, value: number) => void;
	updateIV: (stat: keyof BaseStats, value: number) => void;
	evTotal: number;
	handleSave: () => TeamPokemon;
}

/**
 * Custom hook that manages the edit form state for a Pokemon.
 * Takes initial Pokemon data and dialog open state as parameters.
 * Syncs the prop to internal state when the dialog opens.
 */
export function usePokemonEditState(
	pokemon: TeamPokemon | null,
	open: boolean,
): UsePokemonEditStateReturn {
	const [editedPokemon, setEditedPokemon] = useState<TeamPokemon>(() =>
		getInitialPokemon(pokemon),
	);

	// Sync pokemon prop to state when dialog opens
	// This is a legitimate use case for syncing props to state on open
	useEffect(() => {
		if (open) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setEditedPokemon(getInitialPokemon(pokemon));
		}
	}, [pokemon, open]);

	// Calculate EV total as derived state (useMemo instead of useState + useEffect)
	const evTotal = useMemo(() => {
		return Object.values(editedPokemon.evs || {}).reduce(
			(sum, val) => sum + (val || 0),
			0,
		);
	}, [editedPokemon.evs]);

	const updateField = useCallback(
		<K extends keyof TeamPokemon>(field: K, value: TeamPokemon[K]) => {
			setEditedPokemon((prev) => ({ ...prev, [field]: value }));
		},
		[],
	);

	const updateMove = useCallback((index: number, move: string) => {
		setEditedPokemon((prev) => {
			const currentMoves = prev.moves || ["", "", "", ""];
			const newMoves = [...currentMoves];
			// Ensure array has at least 4 slots
			while (newMoves.length < 4) newMoves.push("");
			newMoves[index] = move;
			return { ...prev, moves: newMoves };
		});
	}, []);

	// Safe access to moves array
	const getMoveValue = useCallback(
		(index: number): string => {
			return editedPokemon.moves?.[index] || "";
		},
		[editedPokemon.moves],
	);

	const updateEV = useCallback(
		(stat: keyof BaseStats, value: number) => {
			const currentTotal = evTotal - (editedPokemon.evs?.[stat] || 0);
			const newValue = Math.min(252, Math.max(0, value));

			// Don't allow total to exceed 508
			if (currentTotal + newValue > 508) {
				return;
			}

			setEditedPokemon((prev) => ({
				...prev,
				evs: { ...prev.evs, [stat]: newValue },
			}));
		},
		[evTotal, editedPokemon.evs],
	);

	const updateIV = useCallback((stat: keyof BaseStats, value: number) => {
		const newValue = Math.min(31, Math.max(0, value));
		setEditedPokemon((prev) => ({
			...prev,
			ivs: { ...prev.ivs, [stat]: newValue },
		}));
	}, []);

	const handleSave = useCallback((): TeamPokemon => {
		// Filter out empty moves
		return {
			...editedPokemon,
			moves: editedPokemon.moves.filter((m) => m.trim() !== ""),
		};
	}, [editedPokemon]);

	return {
		editedPokemon,
		updateField,
		updateMove,
		getMoveValue,
		updateEV,
		updateIV,
		evTotal,
		handleSave,
	};
}
