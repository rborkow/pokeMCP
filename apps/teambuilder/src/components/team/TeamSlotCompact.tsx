"use client";

import { Plus } from "lucide-react";
import { getPokemonTypes } from "@/lib/data/pokemon-types";
import { TYPE_BG_CLASSES } from "@/lib/data/type-colors";
import { toDisplayName } from "@/lib/showdown-parser";
import { cn } from "@/lib/utils";
import type { TeamPokemon } from "@/types/pokemon";
import { NewSlotBadge } from "./NewSlotBadge";
import { PokemonSprite } from "./PokemonSprite";

export interface TeamSlotCompactProps {
    slot: number;
    pokemon: TeamPokemon | null;
    onClick?: () => void;
}

/**
 * Compact 2×3 sidebar variant of TeamSlot. Ships without the NEW-slot flash
 * or hover glow — those arrive in Phase 4 alongside two-way editing.
 */
export function TeamSlotCompact({ slot, pokemon, onClick }: TeamSlotCompactProps) {
    if (!pokemon) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="chat-first-inset group flex aspect-[5/3] flex-col items-center justify-center gap-1 rounded-md text-muted-foreground/70 transition-colors hover:text-foreground"
                aria-label={`Add Pokémon to slot ${slot + 1}`}
            >
                <Plus className="h-4 w-4" />
                <span className="text-[10px] font-mono tracking-wider uppercase">Empty</span>
            </button>
        );
    }

    const types = getPokemonTypes(pokemon.pokemon);
    const primaryType = types[0];
    const accent = primaryType ? TYPE_BG_CLASSES[primaryType] : "bg-muted";
    const roleHint = pokemon.item || pokemon.ability || "—";

    return (
        <button
            type="button"
            onClick={onClick}
            className="chat-first-panel group relative flex aspect-[5/3] items-center gap-2 rounded-md p-2 text-left transition-colors hover:border-border-hairline-strong hover:bg-muted/10"
            aria-label={`Edit ${toDisplayName(pokemon.pokemon)}`}
        >
            <NewSlotBadge slot={slot} />
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", accent)} aria-hidden />
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="relative h-8 w-8 shrink-0">
                    <PokemonSprite pokemon={pokemon.pokemon} size="sm" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium leading-tight text-foreground">
                        {toDisplayName(pokemon.pokemon)}
                    </div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                        {roleHint}
                    </div>
                </div>
            </div>
        </button>
    );
}
