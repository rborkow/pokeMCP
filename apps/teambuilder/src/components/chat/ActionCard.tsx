"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTeamStore } from "@/stores/team-store";
import { useChatStore } from "@/stores/chat-store";
import { useHistoryStore } from "@/stores/history-store";
import type { TeamAction } from "@/types/chat";
import { Check, X, Sparkles, AlertTriangle, RefreshCw } from "lucide-react";
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
  update_nature: "Change Nature",
  update_evs: "Adjust EVs",
  update_tera_type: "Change Tera Type",
  update_move: "Change Move",
};

export function ActionCard({ action, isApplied = false }: ActionCardProps) {
  const { team, setPokemon, removePokemon } = useTeamStore();
  const { setPendingAction, addMessage, lastUserPrompt, queuePrompt } = useChatStore();
  const { pushState } = useHistoryStore();

  const hasValidationErrors = action.validationErrors && action.validationErrors.length > 0;

  const handleApply = () => {
    // Apply the change based on action type
    switch (action.type) {
      // Update actions: merge with existing Pokemon data
      case "update_moveset":
      case "update_item":
      case "update_ability":
      case "update_nature":
      case "update_evs":
      case "update_tera_type": {
        const existing = team[action.slot];
        if (!existing) {
          console.error("Cannot update: no Pokemon in slot", action.slot);
          break;
        }
        // Merge existing data with payload updates
        setPokemon(action.slot, {
          ...existing,
          ...action.payload,
          // Explicit fallbacks for critical fields
          pokemon: action.payload.pokemon ?? existing.pokemon,
          moves: action.payload.moves ?? existing.moves,
        });
        break;
      }
      // Single move update: replace just one move slot
      case "update_move": {
        const existing = team[action.slot];
        if (!existing) {
          console.error("Cannot update: no Pokemon in slot", action.slot);
          break;
        }
        const moveSlot = (action.payload as { moveSlot?: number }).moveSlot ?? 0;
        const newMove = action.payload.moves?.[0];
        if (newMove !== undefined) {
          const updatedMoves = [...(existing.moves || [])];
          updatedMoves[moveSlot] = newMove;
          setPokemon(action.slot, {
            ...existing,
            moves: updatedMoves,
          });
        }
        break;
      }
      // Add/replace actions: require full Pokemon data
      case "add_pokemon":
      case "replace_pokemon":
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

  const handleRetry = () => {
    if (lastUserPrompt) {
      setPendingAction(null);
      addMessage({
        role: "system",
        content: "Retrying request...",
      });
      queuePrompt(lastUserPrompt);
    }
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

        {/* Validation errors */}
        {hasValidationErrors && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-3">
            <p className="text-sm font-medium text-destructive flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" />
              Validation Issues
            </p>
            <ul className="text-xs text-destructive/80 space-y-1 list-disc list-inside">
              {action.validationErrors?.map((err, i) => (
                <li key={i}>{err.message}</li>
              ))}
            </ul>
          </div>
        )}

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
          <div className="flex-1 text-xs space-y-2">
            {/* Nature change */}
            {action.type === "update_nature" && action.payload.nature && (
              <p>
                <span className="text-muted-foreground">Nature:</span>{" "}
                <span className="text-muted-foreground">{team[action.slot]?.nature || "None"}</span>
                <span className="mx-1">→</span>
                <span className="font-medium">{action.payload.nature}</span>
              </p>
            )}

            {/* EV change */}
            {action.type === "update_evs" && action.payload.evs && (
              <div>
                <p className="text-muted-foreground mb-1">New EVs:</p>
                <Badge variant="outline" className="text-xs">
                  {Object.entries(action.payload.evs)
                    .filter(([, v]) => v && v > 0)
                    .map(([stat, v]) => `${v} ${stat.toUpperCase()}`)
                    .join(" / ")}
                </Badge>
              </div>
            )}

            {/* Tera type change */}
            {action.type === "update_tera_type" && action.payload.teraType && (
              <p>
                <span className="text-muted-foreground">Tera Type:</span>{" "}
                <span className="text-muted-foreground">{team[action.slot]?.teraType || "None"}</span>
                <span className="mx-1">→</span>
                <span className="font-medium">{action.payload.teraType}</span>
              </p>
            )}

            {/* Single move change */}
            {action.type === "update_move" && action.payload.moves?.[0] && (
              <p>
                <span className="text-muted-foreground">
                  Move {((action.payload as { moveSlot?: number }).moveSlot ?? 0) + 1}:
                </span>{" "}
                <span className="text-muted-foreground">
                  {team[action.slot]?.moves?.[(action.payload as { moveSlot?: number }).moveSlot ?? 0] || "None"}
                </span>
                <span className="mx-1">→</span>
                <span className="font-medium">{action.payload.moves[0]}</span>
              </p>
            )}

            {/* Item change */}
            {action.type === "update_item" && action.payload.item && (
              <p>
                <span className="text-muted-foreground">Item:</span>{" "}
                <span className="text-muted-foreground">{team[action.slot]?.item || "None"}</span>
                <span className="mx-1">→</span>
                <span className="font-medium">{action.payload.item}</span>
              </p>
            )}

            {/* Ability change */}
            {action.type === "update_ability" && action.payload.ability && (
              <p>
                <span className="text-muted-foreground">Ability:</span>{" "}
                <span className="text-muted-foreground">{team[action.slot]?.ability || "None"}</span>
                <span className="mx-1">→</span>
                <span className="font-medium">{action.payload.ability}</span>
              </p>
            )}

            {/* Full moves list (for add/replace/update_moveset) */}
            {action.payload.moves && action.payload.moves.length > 0 &&
             !["update_move", "update_item", "update_ability", "update_nature", "update_evs", "update_tera_type"].includes(action.type) && (
              <div>
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
        </div>
      </CardContent>

      {!isApplied && (
        <CardFooter className="pt-2 gap-2">
          <Button
            onClick={handleApply}
            size="sm"
            className="gap-1"
            disabled={hasValidationErrors}
          >
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
          {hasValidationErrors && lastUserPrompt && (
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
