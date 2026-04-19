"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTeamStore } from "@/stores/team-store";
import {
    getActiveMegaForm,
    getActiveMegaSlot,
    getEffectiveTypes,
    isActiveMegaDataPending,
} from "@/lib/champions-utils";
import { TYPE_BG_CLASSES } from "@/lib/data/type-colors";
import { analyzeTeamCoverage } from "@/lib/type-analysis";

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
