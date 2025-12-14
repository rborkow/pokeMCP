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
      <CardContent className="p-3 flex flex-col items-center gap-1">
        <div className="w-16 h-16 flex items-center justify-center">
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

        {/* Item */}
        {pokemon.item && (
          <p className="text-xs text-muted-foreground truncate w-full text-center">
            @ {pokemon.item}
          </p>
        )}

        {/* Ability */}
        {pokemon.ability && (
          <p className="text-[10px] text-muted-foreground truncate w-full text-center">
            {pokemon.ability}
          </p>
        )}

        {/* Moves summary */}
        {pokemon.moves && pokemon.moves.length > 0 && (
          <p className="text-[10px] text-muted-foreground truncate w-full text-center">
            {pokemon.moves.slice(0, 2).join(" / ")}
            {pokemon.moves.length > 2 && "..."}
          </p>
        )}

        {/* Tera Type */}
        {pokemon.teraType && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Tera: {pokemon.teraType}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
