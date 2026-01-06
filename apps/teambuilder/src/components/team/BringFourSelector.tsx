"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "./PokemonSprite";
import { toDisplayName } from "@/lib/showdown-parser";
import type { TeamPokemon } from "@/types/pokemon";
import { Users, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface BringFourSelectorProps {
  team: TeamPokemon[];
}

export function BringFourSelector({ team }: BringFourSelectorProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  if (team.length < 4) {
    return null; // Need at least 4 Pokemon to use this feature
  }

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else if (newSelected.size < 4) {
      newSelected.add(index);
    }
    setSelected(newSelected);
  };

  const resetSelection = () => {
    setSelected(new Set());
  };

  const selectedPokemon = team.filter((_, i) => selected.has(i));
  const isComplete = selected.size === 4;

  return (
    <Card className="mt-4 border-dashed">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Team Preview Simulator</CardTitle>
          </div>
          <Badge variant={isComplete ? "default" : "secondary"} className="text-xs">
            {selected.size}/4 selected
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          In VGC, you bring 6 but pick 4 for each battle. Select your 4 for this matchup.
        </p>
      </CardHeader>
      <CardContent>
        {/* Selection Grid */}
        <div className="flex flex-wrap gap-2 mb-3">
          {team.map((pokemon, index) => {
            const isSelected = selected.has(index);
            const isDisabled = !isSelected && selected.size >= 4;

            return (
              <button
                key={index}
                onClick={() => toggleSelection(index)}
                disabled={isDisabled}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : isDisabled
                      ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                      : "border-border bg-card hover:border-primary/50"
                )}
              >
                <PokemonSprite pokemon={pokemon.pokemon} size="sm" />
                <span className="text-sm font-medium">{toDisplayName(pokemon.pokemon)}</span>
                {isSelected && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {Array.from(selected).indexOf(index) + 1}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Team Summary */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-2">Bringing:</span>
              {selectedPokemon.map((pokemon, i) => (
                <PokemonSprite key={i} pokemon={pokemon.pokemon} size="sm" />
              ))}
              {Array.from({ length: 4 - selected.size }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="w-8 h-8 rounded bg-muted/50 border border-dashed border-border"
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetSelection}
              className="text-xs h-7"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        )}

        {/* Tips for incomplete selection */}
        {!isComplete && selected.size > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Select {4 - selected.size} more Pokemon to complete your team preview selection.
          </p>
        )}

        {/* Tips when complete */}
        {isComplete && (
          <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Consider:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Do your leads have good speed control options?</li>
              <li>Can you handle Trick Room if opponent sets it?</li>
              <li>Do you have Protect on key Pokemon for scouting?</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
