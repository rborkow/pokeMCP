"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTeamStore } from "@/stores/team-store";
import { useChatStore } from "@/stores/chat-store";
import { useHistoryStore } from "@/stores/history-store";
import type { TeamAction } from "@/types/chat";
import { Check, X, Sparkles } from "lucide-react";
import { PokemonSprite } from "@/components/team/PokemonSprite";

interface ActionCardProps {
  action: TeamAction;
  isApplied?: boolean;
}

const ACTION_LABELS: Record<TeamAction["type"], string> = {
  add_pokemon: "Add Pokemon",
  replace_pokemon: "Replace Pokemon",
  update_moveset: "Update Moveset",
  remove_pokemon: "Remove Pokemon",
  update_item: "Change Item",
  update_ability: "Change Ability",
};

export function ActionCard({ action, isApplied = false }: ActionCardProps) {
  const { team, setPokemon, removePokemon } = useTeamStore();
  const { setPendingAction, addMessage } = useChatStore();
  const { pushState } = useHistoryStore();

  const handleApply = () => {
    // Apply the change based on action type
    switch (action.type) {
      case "add_pokemon":
      case "replace_pokemon":
      case "update_moveset":
      case "update_item":
      case "update_ability":
        if (action.payload.pokemon) {
          setPokemon(action.slot, {
            pokemon: action.payload.pokemon,
            moves: action.payload.moves || [],
            ability: action.payload.ability,
            item: action.payload.item,
            evs: action.payload.evs,
            ivs: action.payload.ivs,
            nature: action.payload.nature,
            teraType: action.payload.teraType,
          });
        }
        break;
      case "remove_pokemon":
        removePokemon(action.slot);
        break;
    }

    // Record in history
    pushState(action.preview, `Applied: ${action.reason}`, "ai");

    // Clear pending and add confirmation
    setPendingAction(null);
    addMessage({
      role: "system",
      content: `Applied: ${action.reason}`,
    });
  };

  const handleDismiss = () => {
    setPendingAction(null);
    addMessage({
      role: "system",
      content: "Suggestion dismissed",
    });
  };

  // Get the Pokemon being affected
  const targetPokemon = action.payload.pokemon;
  const currentPokemon = team[action.slot]?.pokemon;

  return (
    <Card className={`border-primary/50 ${isApplied ? "opacity-60" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {ACTION_LABELS[action.type]}
          </CardTitle>
          {isApplied && (
            <Badge variant="secondary" className="text-xs">
              Applied
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        <p className="text-sm text-muted-foreground mb-3">{action.reason}</p>

        {/* Visual preview of the change */}
        <div className="flex items-center gap-4">
          {/* Current state (for replace/update) */}
          {currentPokemon && action.type !== "add_pokemon" && (
            <div className="flex flex-col items-center">
              <PokemonSprite pokemon={currentPokemon} size="sm" />
              <span className="text-xs text-muted-foreground mt-1">
                {currentPokemon}
              </span>
            </div>
          )}

          {/* Arrow for transitions */}
          {currentPokemon && action.type !== "add_pokemon" && targetPokemon && (
            <span className="text-muted-foreground">→</span>
          )}

          {/* New state */}
          {targetPokemon && (
            <div className="flex flex-col items-center">
              <PokemonSprite pokemon={targetPokemon} size="sm" />
              <span className="text-xs font-medium mt-1">{targetPokemon}</span>
            </div>
          )}

          {/* Show details for the change */}
          {action.payload.moves && action.payload.moves.length > 0 && (
            <div className="flex-1 text-xs">
              <p className="text-muted-foreground mb-1">Moves:</p>
              <div className="flex flex-wrap gap-1">
                {action.payload.moves.map((move) => (
                  <Badge key={move} variant="outline" className="text-xs">
                    {move}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {!isApplied && (
        <CardFooter className="pt-2 gap-2">
          <Button onClick={handleApply} size="sm" className="gap-1">
            <Check className="h-3 w-3" />
            Apply
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            size="sm"
            className="gap-1"
          >
            <X className="h-3 w-3" />
            Dismiss
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
