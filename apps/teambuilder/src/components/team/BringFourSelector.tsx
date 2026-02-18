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
import {
    VGC_BRING_COUNT,
    VGC_MIN_TEAM_FOR_PREVIEW,
    VGC_TEAM_PREVIEW_TIPS,
} from "@/lib/constants/vgc";

interface BringFourSelectorProps {
    team: TeamPokemon[];
}

export function BringFourSelector({ team }: BringFourSelectorProps) {
    const [selected, setSelected] = useState<Set<number>>(new Set());

    // Guard against invalid team data
    if (!team || !Array.isArray(team)) {
        return null;
    }

    // Need at least VGC_MIN_TEAM_FOR_PREVIEW Pokemon to use this feature
    if (team.length < VGC_MIN_TEAM_FOR_PREVIEW) {
        return null;
    }

    const toggleSelection = (index: number) => {
        // Validate index is within bounds
        if (index < 0 || index >= team.length) {
            return;
        }

        const newSelected = new Set(selected);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else if (newSelected.size < VGC_BRING_COUNT) {
            newSelected.add(index);
        }
        setSelected(newSelected);
    };

    const resetSelection = () => {
        setSelected(new Set());
    };

    const selectedPokemon = team.filter((_, i) => selected.has(i));
    const isComplete = selected.size === VGC_BRING_COUNT;
    const remainingSlots = VGC_BRING_COUNT - selected.size;

    return (
        <Card className="mt-4 border-dashed" data-testid="bring-four-selector">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">
                            Team Preview Simulator
                        </CardTitle>
                    </div>
                    <Badge variant={isComplete ? "default" : "secondary"} className="text-xs">
                        {selected.size}/{VGC_BRING_COUNT} selected
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                    In VGC, you bring{" "}
                    {team.length > VGC_BRING_COUNT ? team.length : VGC_BRING_COUNT} but pick{" "}
                    {VGC_BRING_COUNT} for each battle. Select your {VGC_BRING_COUNT} for this
                    matchup.
                </p>
            </CardHeader>
            <CardContent>
                {/* Selection Grid */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {team.map((pokemon, index) => {
                        const isSelected = selected.has(index);
                        const isDisabled = !isSelected && selected.size >= VGC_BRING_COUNT;

                        return (
                            <button
                                key={index}
                                onClick={() => toggleSelection(index)}
                                disabled={isDisabled}
                                data-testid={`pokemon-select-${index}`}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                                    isSelected
                                        ? "border-primary bg-primary/10 text-primary"
                                        : isDisabled
                                          ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                                          : "border-border bg-card hover:border-primary/50",
                                )}
                            >
                                <PokemonSprite pokemon={pokemon.pokemon} size="sm" />
                                <span className="text-sm font-medium">
                                    {toDisplayName(pokemon.pokemon)}
                                </span>
                                {isSelected && (
                                    <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0"
                                        data-testid={`selection-order-${index}`}
                                    >
                                        {Array.from(selected).indexOf(index) + 1}
                                    </Badge>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Selected Team Summary */}
                {selected.size > 0 && (
                    <div
                        className="flex items-center justify-between pt-3 border-t"
                        data-testid="selection-summary"
                    >
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground mr-2">Bringing:</span>
                            {selectedPokemon.map((pokemon, i) => (
                                <PokemonSprite key={i} pokemon={pokemon.pokemon} size="sm" />
                            ))}
                            {Array.from({ length: remainingSlots }).map((_, i) => (
                                <div
                                    key={`empty-${i}`}
                                    className="w-8 h-8 rounded bg-muted/50 border border-dashed border-border"
                                    data-testid={`empty-slot-${i}`}
                                />
                            ))}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetSelection}
                            className="text-xs h-7"
                            data-testid="reset-button"
                        >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Reset
                        </Button>
                    </div>
                )}

                {/* Tips for incomplete selection */}
                {!isComplete && selected.size > 0 && (
                    <p className="text-xs text-muted-foreground mt-2" data-testid="incomplete-tip">
                        Select {remainingSlots} more Pokemon to complete your team preview
                        selection.
                    </p>
                )}

                {/* Tips when complete */}
                {isComplete && (
                    <div
                        className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground"
                        data-testid="complete-tips"
                    >
                        <p className="font-medium text-foreground mb-1">Consider:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            {VGC_TEAM_PREVIEW_TIPS.map((tip, i) => (
                                <li key={i}>{tip}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
