"use client";

import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "./PokemonSprite";
import type { TeamPokemon, PokemonType } from "@/types/pokemon";
import { X, Sparkles, Package } from "lucide-react";
import { getPokemonTypes } from "@/lib/data/pokemon-types";
import { toDisplayName } from "@/lib/showdown-parser";

// Type colors for badges - using Pokemon type colors from CSS variables
const TYPE_COLORS: Record<PokemonType, string> = {
  Normal: "bg-pokemon-normal",
  Fire: "bg-pokemon-fire",
  Water: "bg-pokemon-water",
  Electric: "bg-pokemon-electric text-black",
  Grass: "bg-pokemon-grass",
  Ice: "bg-pokemon-ice text-black",
  Fighting: "bg-pokemon-fighting",
  Poison: "bg-pokemon-poison",
  Ground: "bg-pokemon-ground",
  Flying: "bg-pokemon-flying text-black",
  Psychic: "bg-pokemon-psychic",
  Bug: "bg-pokemon-bug",
  Rock: "bg-pokemon-rock",
  Ghost: "bg-pokemon-ghost",
  Dragon: "bg-pokemon-dragon",
  Dark: "bg-pokemon-dark",
  Steel: "bg-pokemon-steel",
  Fairy: "bg-pokemon-fairy text-black",
};

// Crystalline Tera type colors - lighter, more gem-like appearance
const TERA_COLORS: Record<string, string> = {
  Normal: "bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 border border-gray-400",
  Fire: "bg-gradient-to-r from-orange-300 to-red-300 text-orange-900 border border-orange-400",
  Water: "bg-gradient-to-r from-blue-300 to-cyan-300 text-blue-900 border border-blue-400",
  Electric: "bg-gradient-to-r from-yellow-200 to-amber-300 text-yellow-900 border border-yellow-400",
  Grass: "bg-gradient-to-r from-green-300 to-emerald-300 text-green-900 border border-green-400",
  Ice: "bg-gradient-to-r from-cyan-200 to-blue-200 text-cyan-900 border border-cyan-300",
  Fighting: "bg-gradient-to-r from-red-400 to-orange-400 text-red-950 border border-red-500",
  Poison: "bg-gradient-to-r from-purple-300 to-fuchsia-300 text-purple-900 border border-purple-400",
  Ground: "bg-gradient-to-r from-amber-300 to-yellow-400 text-amber-900 border border-amber-500",
  Flying: "bg-gradient-to-r from-indigo-200 to-sky-200 text-indigo-900 border border-indigo-300",
  Psychic: "bg-gradient-to-r from-pink-300 to-rose-300 text-pink-900 border border-pink-400",
  Bug: "bg-gradient-to-r from-lime-300 to-green-300 text-lime-900 border border-lime-400",
  Rock: "bg-gradient-to-r from-stone-300 to-amber-300 text-stone-900 border border-stone-400",
  Ghost: "bg-gradient-to-r from-purple-400 to-indigo-400 text-purple-950 border border-purple-500",
  Dragon: "bg-gradient-to-r from-violet-400 to-indigo-400 text-violet-950 border border-violet-500",
  Dark: "bg-gradient-to-r from-stone-400 to-gray-500 text-stone-950 border border-stone-600",
  Steel: "bg-gradient-to-r from-slate-300 to-zinc-300 text-slate-900 border border-slate-400",
  Fairy: "bg-gradient-to-r from-pink-200 to-rose-200 text-pink-900 border border-pink-300",
  Stellar: "bg-gradient-to-r from-violet-300 via-pink-300 to-amber-300 text-violet-900 border border-violet-400",
};

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
      className={`pokemon-card glow-effect group animate-in fade-in slide-in-from-bottom-2 ${
        isSelected ? "border-primary ring-2 ring-primary/20" : ""
      }`}
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "both" }}
      onClick={onSelect}
    >
      {/* Remove button - positioned inside card with proper spacing */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive z-10"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Header: Sprite + Name/Types - horizontal layout like reference */}
      <div className="flex items-start gap-3 mb-3">
        {/* Pokemon sprite */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center overflow-hidden">
            <div className="group-hover:scale-110 transition-transform duration-300">
              <PokemonSprite pokemon={pokemon.pokemon} size="lg" />
            </div>
          </div>
        </div>

        {/* Name, Nickname, Types */}
        <div className="flex-1 min-w-0">
          {pokemon.nickname && (
            <p className="text-xs text-primary font-medium truncate">
              &ldquo;{pokemon.nickname}&rdquo;
            </p>
          )}
          <h3 className="font-display font-bold text-base text-foreground capitalize truncate">
            {toDisplayName(pokemon.pokemon)}
          </h3>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {types.map((type) => (
              <span
                key={type}
                className={`type-badge ${TYPE_COLORS[type]} text-foreground shadow-sm px-2 py-0.5 text-[10px]`}
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Item & Ability */}
      <div className="flex gap-2 mb-3">
        {pokemon.item && (
          <div className="flex flex-col px-2 py-1.5 rounded-md bg-muted/50 flex-1 min-w-0">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Package className="w-2.5 h-2.5" />
              Item
            </span>
            <span className="text-[11px] text-foreground truncate font-medium">{pokemon.item}</span>
          </div>
        )}
        {pokemon.ability && (
          <div className="flex flex-col px-2 py-1.5 rounded-md bg-muted/50 flex-1 min-w-0">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Ability
            </span>
            <span className="text-[11px] text-foreground truncate font-medium">{pokemon.ability}</span>
          </div>
        )}
      </div>

      {/* Moves */}
      {pokemon.moves && pokemon.moves.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Moves</p>
          <div className="grid grid-cols-2 gap-1">
            {pokemon.moves.map((move, idx) => (
              <div
                key={idx}
                className="px-2 py-1.5 rounded-md bg-muted/30 border border-border/30 text-[11px] text-foreground truncate text-center hover:bg-muted/50 transition-colors cursor-default"
              >
                {move}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tera Type with crystalline styling */}
      {pokemon.teraType && (
        <div className="mt-2">
          <Badge
            className={`text-[10px] px-1.5 py-0 ${TERA_COLORS[pokemon.teraType] || "bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 border border-gray-400"}`}
          >
            Tera: {pokemon.teraType}
          </Badge>
        </div>
      )}
    </div>
  );
}
