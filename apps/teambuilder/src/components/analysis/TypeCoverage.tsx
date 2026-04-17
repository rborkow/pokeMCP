"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTeamStore } from "@/stores/team-store";
import { TYPES, type PokemonType } from "@/types/pokemon";
import {
    getActiveMegaForm,
    getActiveMegaSlot,
    getEffectiveTypes,
    isActiveMegaDataPending,
} from "@/lib/champions-utils";
import { TYPE_BG_CLASSES } from "@/lib/data/type-colors";

// Simplified type effectiveness (1 = weak, 2 = 2x weak, 0 = resist, -1 = immune)
const TYPE_CHART: Record<string, Record<string, number>> = {
    Normal: { Fighting: 1, Ghost: -1 },
    Fire: {
        Water: 1,
        Ground: 1,
        Rock: 1,
        Fire: 0,
        Grass: 0,
        Ice: 0,
        Bug: 0,
        Steel: 0,
        Fairy: 0,
    },
    Water: { Electric: 1, Grass: 1, Fire: 0, Water: 0, Ice: 0, Steel: 0 },
    Electric: { Ground: 1, Electric: 0, Flying: 0, Steel: 0 },
    Grass: {
        Fire: 1,
        Ice: 1,
        Poison: 1,
        Flying: 1,
        Bug: 1,
        Water: 0,
        Electric: 0,
        Grass: 0,
        Ground: 0,
    },
    Ice: { Fire: 1, Fighting: 1, Rock: 1, Steel: 1, Ice: 0 },
    Fighting: { Flying: 1, Psychic: 1, Fairy: 1, Bug: 0, Rock: 0, Dark: 0 },
    Poison: {
        Ground: 1,
        Psychic: 1,
        Grass: 0,
        Fighting: 0,
        Poison: 0,
        Bug: 0,
        Fairy: 0,
    },
    Ground: { Water: 1, Grass: 1, Ice: 1, Electric: -1, Poison: 0, Rock: 0 },
    Flying: {
        Electric: 1,
        Ice: 1,
        Rock: 1,
        Ground: -1,
        Grass: 0,
        Fighting: 0,
        Bug: 0,
    },
    Psychic: { Bug: 1, Ghost: 1, Dark: 1, Fighting: 0, Psychic: 0 },
    Bug: { Fire: 1, Flying: 1, Rock: 1, Grass: 0, Fighting: 0, Ground: 0 },
    Rock: {
        Water: 1,
        Grass: 1,
        Fighting: 1,
        Ground: 1,
        Steel: 1,
        Normal: 0,
        Fire: 0,
        Poison: 0,
        Flying: 0,
    },
    Ghost: { Ghost: 1, Dark: 1, Normal: -1, Fighting: -1, Poison: 0, Bug: 0 },
    Dragon: {
        Ice: 1,
        Dragon: 1,
        Fairy: 1,
        Fire: 0,
        Water: 0,
        Electric: 0,
        Grass: 0,
    },
    Dark: { Fighting: 1, Bug: 1, Fairy: 1, Psychic: -1, Ghost: 0, Dark: 0 },
    Steel: {
        Fire: 1,
        Fighting: 1,
        Ground: 1,
        Poison: -1,
        Normal: 0,
        Grass: 0,
        Ice: 0,
        Flying: 0,
        Psychic: 0,
        Bug: 0,
        Rock: 0,
        Dragon: 0,
        Steel: 0,
        Fairy: 0,
    },
    Fairy: { Poison: 1, Steel: 1, Dragon: -1, Fighting: 0, Bug: 0, Dark: 0 },
};

interface TypeEntry {
    type: PokemonType;
    count: number;
    pokemon: string[]; // Names of Pokemon with this weakness/resistance
}

interface TypeAnalysis {
    weaknesses: TypeEntry[];
    resistances: TypeEntry[];
    immunities: TypeEntry[];
}

function analyzeTeamCoverage(teamData: { name: string; types: string[] }[]): TypeAnalysis {
    const weaknessMap: Record<string, string[]> = {};
    const resistMap: Record<string, string[]> = {};
    const immuneMap: Record<string, string[]> = {};

    // For each Pokemon
    for (const { name, types } of teamData) {
        // Check each attacking type
        for (const attackType of TYPES) {
            let effectiveness = 1;

            for (const defType of types) {
                const chart = TYPE_CHART[defType];
                if (chart && chart[attackType] !== undefined) {
                    if (chart[attackType] === -1) {
                        effectiveness = 0; // Immune
                        break;
                    }
                    if (chart[attackType] === 1 || chart[attackType] === 2) {
                        effectiveness *= 2;
                    } else if (chart[attackType] === 0) {
                        effectiveness *= 0.5;
                    }
                }
            }

            if (effectiveness === 0) {
                if (!immuneMap[attackType]) immuneMap[attackType] = [];
                immuneMap[attackType].push(name);
            } else if (effectiveness >= 2) {
                if (!weaknessMap[attackType]) weaknessMap[attackType] = [];
                weaknessMap[attackType].push(name);
            } else if (effectiveness <= 0.5) {
                if (!resistMap[attackType]) resistMap[attackType] = [];
                resistMap[attackType].push(name);
            }
        }
    }

    const toEntries = (map: Record<string, string[]>): TypeEntry[] =>
        Object.entries(map)
            .map(([type, pokemon]) => ({
                type: type as PokemonType,
                count: pokemon.length,
                pokemon,
            }))
            .sort((a, b) => b.count - a.count);

    return {
        weaknesses: toEntries(weaknessMap),
        resistances: toEntries(resistMap),
        immunities: toEntries(immuneMap),
    };
}

export function TypeCoverage() {
    const { team, format } = useTeamStore();

    const activeMega = useMemo(() => getActiveMegaForm(team, format), [team, format]);
    const megaDataPending = useMemo(() => isActiveMegaDataPending(team, format), [team, format]);

    const activeMegaSlot = useMemo(() => getActiveMegaSlot(team, format), [team, format]);

    const analysis = useMemo(() => {
        if (team.length === 0) return null;

        const teamData = team.map((p, i) => ({
            // Annotate the active-Mega slot so tooltips make the overlay obvious.
            name:
                i === activeMegaSlot && activeMega
                    ? `${p.pokemon} (as ${activeMega.megaName})`
                    : p.pokemon,
            types: getEffectiveTypes(p, team, format),
        }));
        return analyzeTeamCoverage(teamData);
    }, [team, format, activeMega, activeMegaSlot]);

    if (team.length === 0) {
        return (
            <div className="glass-panel">
                <h3 className="font-display text-lg font-semibold mb-4">Type Coverage</h3>
                <p className="text-muted-foreground text-sm">
                    Add Pokemon to see type coverage analysis
                </p>
            </div>
        );
    }

    return (
        <div className="glass-panel">
            <h3 className="font-display text-lg font-semibold mb-4">Type Coverage Analysis</h3>
            {activeMega && (
                <div className="mb-4 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                    {megaDataPending ? (
                        <>
                            Omni Ring: {activeMega.megaName} detected, but post-Mega type data is
                            pending publication by The Pokémon Company. Coverage below uses base
                            types.
                        </>
                    ) : (
                        <>
                            Omni Ring: coverage reflects{" "}
                            <span className="font-semibold">{activeMega.megaName}</span> (post-Mega
                            types: {activeMega.postMegaTypes?.join(" / ") ?? "—"}).
                        </>
                    )}
                </div>
            )}
            <div className="space-y-4">
                {/* Weaknesses */}
                <div>
                    <h4 className="text-sm font-medium mb-2 text-destructive">Team Weaknesses</h4>
                    <div className="flex flex-wrap gap-2">
                        {analysis?.weaknesses.length === 0 ? (
                            <span className="text-sm text-muted-foreground">
                                No shared weaknesses!
                            </span>
                        ) : (
                            analysis?.weaknesses.map(({ type, count, pokemon }) => (
                                <Tooltip key={type}>
                                    <TooltipTrigger asChild>
                                        <Badge
                                            className={`${TYPE_BG_CLASSES[type]} text-foreground cursor-help`}
                                        >
                                            {type} ({count})
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="font-semibold text-destructive">
                                            Weak to {type}:
                                        </p>
                                        <p className="text-sm">{pokemon.join(", ")}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))
                        )}
                    </div>
                </div>

                {/* Resistances */}
                <div>
                    <h4 className="text-sm font-medium mb-2 text-green-500">Team Resistances</h4>
                    <div className="flex flex-wrap gap-2">
                        {analysis?.resistances.length === 0 ? (
                            <span className="text-sm text-muted-foreground">No resistances</span>
                        ) : (
                            analysis?.resistances.slice(0, 8).map(({ type, count, pokemon }) => (
                                <Tooltip key={type}>
                                    <TooltipTrigger asChild>
                                        <Badge
                                            variant="outline"
                                            className="border-2 cursor-help"
                                            style={{
                                                borderColor: `var(--type-${type.toLowerCase()})`,
                                            }}
                                        >
                                            {type} ({count})
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="font-semibold text-green-500">
                                            Resists {type}:
                                        </p>
                                        <p className="text-sm">{pokemon.join(", ")}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))
                        )}
                    </div>
                </div>

                {/* Immunities */}
                {analysis?.immunities && analysis.immunities.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium mb-2 text-blue-500">Team Immunities</h4>
                        <div className="flex flex-wrap gap-2">
                            {analysis.immunities.map(({ type, count, pokemon }) => (
                                <Tooltip key={type}>
                                    <TooltipTrigger asChild>
                                        <Badge variant="secondary" className="cursor-help">
                                            {type} ({count})
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="font-semibold text-blue-500">
                                            Immune to {type}:
                                        </p>
                                        <p className="text-sm">{pokemon.join(", ")}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
