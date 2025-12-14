"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PokemonSprite } from "./PokemonSprite";
import type { TeamPokemon, PokemonType } from "@/types/pokemon";
import { X } from "lucide-react";
import { getPokemonTypes } from "@/lib/data/pokemon-types";

// Type colors for badges
const TYPE_COLORS: Record<PokemonType, string> = {
  Normal: "bg-gray-400",
  Fire: "bg-orange-500",
  Water: "bg-blue-500",
  Electric: "bg-yellow-400 text-black",
  Grass: "bg-green-500",
  Ice: "bg-cyan-300 text-black",
  Fighting: "bg-red-700",
  Poison: "bg-purple-500",
  Ground: "bg-amber-600",
  Flying: "bg-indigo-300 text-black",
  Psychic: "bg-pink-500",
  Bug: "bg-lime-500 text-black",
  Rock: "bg-stone-500",
  Ghost: "bg-purple-700",
  Dragon: "bg-violet-600",
  Dark: "bg-stone-700",
  Steel: "bg-slate-400",
  Fairy: "bg-pink-300 text-black",
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
  isSelected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
}

export function TeamSlot({
  pokemon,
  slot: _slot,
  isSelected = false,
  onSelect,
  onRemove,
}: TeamSlotProps) {
  const types = getPokemonTypes(pokemon.pokemon);

  return (
    <Card
      className={`relative cursor-pointer transition-all hover:border-primary/50 ${
        isSelected ? "border-primary ring-2 ring-primary/20" : ""
      }`}
      onClick={onSelect}
    >
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
      <CardContent className="p-2 flex flex-col items-center gap-0.5">
        <div className="w-14 h-14 flex items-center justify-center">
          <PokemonSprite pokemon={pokemon.pokemon} size="md" />
        </div>

        {/* Name */}
        <p className="font-medium text-sm truncate w-full text-center">
          {pokemon.nickname || pokemon.pokemon}
        </p>

        {/* Types */}
        {types.length > 0 && (
          <div className="flex gap-1">
            {types.map((type) => (
              <Badge
                key={type}
                className={`${TYPE_COLORS[type]} text-[10px] px-1.5 py-0`}
              >
                {type}
              </Badge>
            ))}
          </div>
        )}

        {/* Item & Ability on same line */}
        <p className="text-[10px] text-muted-foreground truncate w-full text-center">
          {pokemon.item && `@ ${pokemon.item}`}
          {pokemon.item && pokemon.ability && " · "}
          {pokemon.ability}
        </p>

        {/* All moves */}
        {pokemon.moves && pokemon.moves.length > 0 && (
          <div className="text-[10px] text-muted-foreground text-center w-full">
            {pokemon.moves.map((move, i) => (
              <span key={i}>
                {move}
                {i < pokemon.moves.length - 1 && " / "}
              </span>
            ))}
          </div>
        )}

        {/* Tera Type with crystalline styling */}
        {pokemon.teraType && (
          <Badge
            className={`text-[10px] px-1.5 py-0 ${TERA_COLORS[pokemon.teraType] || "bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 border border-gray-400"}`}
          >
            ✦ Tera: {pokemon.teraType}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
