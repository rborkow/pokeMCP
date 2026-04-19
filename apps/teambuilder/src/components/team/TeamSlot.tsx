"use client";

import { Package, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPokemonTypes } from "@/lib/data/pokemon-types";
import { TYPE_BG_CLASSES } from "@/lib/data/type-colors";
import { toDisplayName } from "@/lib/showdown-parser";
import type { TeamPokemon } from "@/types/pokemon";
import { EVBar } from "./EVBar";
import { MoveBadge } from "./MoveBadge";
import { PokemonSprite } from "./PokemonSprite";

// Flat Tera type chips — solid tinted fill at low opacity with a matching
// text color. Preserves type identity without the gradient decoration that
// the v2 direction retired.
const TERA_COLORS: Record<string, string> = {
    Normal: "bg-gray-500/15 text-gray-300 border border-gray-500/30",
    Fire: "bg-orange-500/15 text-orange-300 border border-orange-500/30",
    Water: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    Electric: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
    Grass: "bg-green-500/15 text-green-300 border border-green-500/30",
    Ice: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30",
    Fighting: "bg-red-500/15 text-red-300 border border-red-500/30",
    Poison: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
    Ground: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    Flying: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
    Psychic: "bg-pink-500/15 text-pink-300 border border-pink-500/30",
    Bug: "bg-lime-500/15 text-lime-300 border border-lime-500/30",
    Rock: "bg-stone-500/15 text-stone-300 border border-stone-500/30",
    Ghost: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
    Dragon: "bg-violet-600/15 text-violet-300 border border-violet-600/30",
    Dark: "bg-zinc-600/15 text-zinc-300 border border-zinc-600/30",
    Steel: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
    Fairy: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    Stellar: "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30",
};

const TERA_DEFAULT_CLASS = "bg-muted/40 text-muted-foreground border border-border";

interface TeamSlotProps {
    pokemon: TeamPokemon;
    slot: number;
    index?: number;
    isSelected?: boolean;
    onSelect?: () => void;
    onRemove?: () => void;
}

export function TeamSlot({
    pokemon,
    index = 0,
    isSelected = false,
    onSelect,
    onRemove,
}: TeamSlotProps) {
    const types = getPokemonTypes(pokemon.pokemon);

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`${toDisplayName(pokemon.pokemon)}${isSelected ? ", selected" : ""}. Click to edit.`}
            className={`chat-first-panel group cursor-pointer rounded-xl p-3 sm:p-4 animate-in fade-in slide-in-from-bottom-2 transition-colors hover:border-border-hairline-strong ${
                isSelected ? "border-primary ring-2 ring-primary/20" : ""
            }`}
            style={{ animationDelay: `${index * 100}ms`, animationFillMode: "both" }}
            onClick={onSelect}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.();
                }
            }}
        >
            {/* Remove button - visible on hover and focus-within for keyboard/touch users */}
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    aria-label={`Remove ${toDisplayName(pokemon.pokemon)}`}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-muted/50 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive focus:bg-destructive/20 focus:text-destructive z-10"
                >
                    <X className="w-4 h-4" />
                </button>
            )}

            {/* Header: Sprite + Name/Types - horizontal layout like reference */}
            <div className="flex items-start gap-2 sm:gap-3 mb-3">
                {/* Pokemon sprite */}
                <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl bg-muted/40 flex items-center justify-center overflow-hidden">
                        <div className="group-hover:scale-110 transition-transform duration-300">
                            <PokemonSprite pokemon={pokemon.pokemon} size="lg" />
                        </div>
                    </div>
                </div>

                {/* Name, Nickname, Types */}
                <div className="flex-1 min-w-0">
                    {pokemon.nickname && (
                        <p className="text-[10px] sm:text-xs text-primary font-medium truncate">
                            &ldquo;{pokemon.nickname}&rdquo;
                        </p>
                    )}
                    <h3 className="font-display font-bold text-sm sm:text-base text-foreground capitalize leading-tight">
                        {toDisplayName(pokemon.pokemon)}
                    </h3>
                    <div className="flex gap-1 mt-1 sm:mt-1.5 flex-wrap">
                        {types.map((type) => (
                            <span
                                key={type}
                                className={`type-badge ${TYPE_BG_CLASSES[type]} text-foreground shadow-sm px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px]`}
                            >
                                {type}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Item & Ability */}
            <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                {pokemon.item && (
                    <div className="flex flex-row sm:flex-col items-center sm:items-start gap-1 px-2 py-1 sm:py-1.5 rounded-md bg-muted/50 sm:flex-1 min-w-0">
                        <span className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1 shrink-0">
                            <Package className="w-2.5 h-2.5" />
                            <span className="hidden sm:inline">Item</span>
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-foreground truncate font-medium">
                            {pokemon.item}
                        </span>
                    </div>
                )}
                {pokemon.ability && (
                    <div className="flex flex-row sm:flex-col items-center sm:items-start gap-1 px-2 py-1 sm:py-1.5 rounded-md bg-muted/50 sm:flex-1 min-w-0">
                        <span className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1 shrink-0">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span className="hidden sm:inline">Ability</span>
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-foreground truncate font-medium">
                            {pokemon.ability}
                        </span>
                    </div>
                )}
            </div>

            {/* Moves */}
            {pokemon.moves && pokemon.moves.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Moves
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                        {pokemon.moves.map((move, idx) => (
                            <MoveBadge key={idx} move={move} />
                        ))}
                    </div>
                </div>
            )}

            {/* EV Distribution */}
            {pokemon.evs && <EVBar evs={pokemon.evs} nature={pokemon.nature} />}

            {/* Tera Type with crystalline styling */}
            {pokemon.teraType && (
                <div className="mt-2">
                    <Badge
                        className={`text-[10px] px-1.5 py-0 ${TERA_COLORS[pokemon.teraType] || TERA_DEFAULT_CLASS}`}
                    >
                        Tera: {pokemon.teraType}
                    </Badge>
                </div>
            )}
        </div>
    );
}
