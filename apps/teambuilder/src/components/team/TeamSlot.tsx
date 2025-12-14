"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PokemonSprite } from "./PokemonSprite";
import type { TeamPokemon } from "@/types/pokemon";
import { X } from "lucide-react";

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
        <div className="text-center min-w-0 w-full">
          <p className="font-medium text-sm truncate">
            {pokemon.nickname || pokemon.pokemon}
          </p>
          {pokemon.item && (
            <p className="text-xs text-muted-foreground truncate">
              @ {pokemon.item}
            </p>
          )}
        </div>
        {pokemon.teraType && (
          <Badge variant="outline" className="text-xs">
            Tera: {pokemon.teraType}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
