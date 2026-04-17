"use client";

import { useMemo, useState } from "react";
import { PokemonSprite } from "@/components/team/PokemonSprite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getActiveMegaForm, getActiveMegaSlot, getEffectiveTypes } from "@/lib/champions-utils";
import { calculateMatchupScore, calculateOffensiveScore } from "@/lib/data/pokemon-types";
import { useMetaThreats } from "@/lib/mcp-client";
import { toDisplayName } from "@/lib/showdown-parser";
import { type MetaThreat, parseMetaThreats } from "@/lib/threat-matrix-utils";
import { useTeamStore } from "@/stores/team-store";
import { getFormatDisplayName } from "@/types/pokemon";
import { TeamSummaryColumn } from "./TeamSummaryColumn";
import { ThreatDetailModal } from "./ThreatDetailModal";
import { ThreatMatrixCell } from "./ThreatMatrixCell";
import { ThreatMatrixLegend } from "./ThreatMatrixLegend";

export function ThreatMatrix() {
    const { team, format, mode } = useTeamStore();
    // Ensure format is lowercase for API calls
    const normalizedFormat = format.toLowerCase();
    const {
        data: metaThreatsData,
        isLoading,
        error,
        effectiveFormat,
        isFallback,
    } = useMetaThreats(normalizedFormat, 10);
    const [selectedThreat, setSelectedThreat] = useState<MetaThreat | null>(null);

    // Parse meta threats
    const metaThreats = useMemo(() => {
        if (!metaThreatsData || typeof metaThreatsData !== "string") {
            return [];
        }
        return parseMetaThreats(metaThreatsData);
    }, [metaThreatsData]);

    const activeMegaSlot = useMemo(() => getActiveMegaSlot(team, format), [team, format]);
    const activeMega = useMemo(() => getActiveMegaForm(team, format), [team, format]);

    // Calculate matchups (both defensive and offensive)
    const matchups = useMemo(() => {
        if (team.length === 0 || metaThreats.length === 0) return [];

        return team.map((pokemon) => {
            const defenderTypes = getEffectiveTypes(pokemon, team, format);
            const hasKnownTypes = defenderTypes.length > 0;
            return metaThreats.map((threat) => ({
                defScore: hasKnownTypes ? calculateMatchupScore(defenderTypes, threat.types) : null,
                offScore: hasKnownTypes
                    ? calculateOffensiveScore(defenderTypes, threat.types)
                    : null,
                defenderTypes,
                attackerTypes: threat.types,
                unknownTypes: !hasKnownTypes,
            }));
        });
    }, [team, metaThreats, format]);

    if (team.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Threat Matrix</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">
                        Add Pokemon to see matchups vs meta threats
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Threat Matrix</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        <span className="text-sm">Loading meta threats...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || metaThreats.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Threat Matrix</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">
                        Could not load meta threats for {getFormatDisplayName(format)}.
                        {error && (
                            <span className="block text-xs text-destructive mt-1">
                                Error: {String(error)}
                            </span>
                        )}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg">Threat Matrix</CardTitle>
                <p className="text-xs text-muted-foreground">
                    Your team vs top {getFormatDisplayName(effectiveFormat)} threats (🛡=Defense,
                    ⚔=Offense)
                </p>
                {isFallback && (
                    <p className="text-xs text-amber-500">
                        Note: Using {getFormatDisplayName(effectiveFormat)} data (stats for{" "}
                        {getFormatDisplayName(format)} not yet available)
                    </p>
                )}
                {activeMega && (
                    <p className="text-xs text-amber-500">
                        Omni Ring: matchups for slot {activeMegaSlot + 1} reflect{" "}
                        <span className="font-semibold">{activeMega.megaName}</span>
                        {activeMega.postMegaTypes
                            ? ` (${activeMega.postMegaTypes.join(" / ")}).`
                            : " (post-Mega type data pending — showing base types)."}
                    </p>
                )}
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <div className="inline-flex gap-1">
                        {/* Row headers (your team) */}
                        <div className="flex flex-col gap-1 pr-2">
                            <div className="h-10" /> {/* Spacer for column headers */}
                            {team.map((pokemon, i) => {
                                const types = getEffectiveTypes(pokemon, team, format);
                                const isMega = i === activeMegaSlot && !!activeMega;
                                return (
                                    <Tooltip key={i}>
                                        <TooltipTrigger asChild>
                                            <div className="min-w-28 h-10 flex items-center gap-2">
                                                <PokemonSprite
                                                    pokemon={pokemon.pokemon}
                                                    size="sm"
                                                />
                                                <span className="text-xs leading-tight flex-1">
                                                    {toDisplayName(pokemon.pokemon)}
                                                    {isMega && (
                                                        <span className="ml-1 text-[10px] text-amber-500 font-semibold uppercase">
                                                            Mega
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                            <p>
                                                {toDisplayName(pokemon.pokemon)}
                                                {isMega && activeMega
                                                    ? ` → ${activeMega.megaName}`
                                                    : ""}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {types.join("/") || "Unknown types"}
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>

                        {/* Matrix grid */}
                        <div className="flex gap-1">
                            {metaThreats.map((threat, threatIndex) => (
                                <div key={threatIndex} className="flex flex-col gap-1">
                                    {/* Column header (threat) - clickable for details */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                className="h-10 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 rounded transition-colors"
                                                onClick={() => setSelectedThreat(threat)}
                                            >
                                                <PokemonSprite pokemon={threat.pokemon} size="sm" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="font-semibold">
                                                {toDisplayName(threat.pokemon)}
                                            </p>
                                            <p className="text-xs">{threat.types.join("/")}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {threat.usage.toFixed(1)}% usage
                                            </p>
                                            <p className="text-xs text-primary mt-1">
                                                Click for details
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>

                                    {/* Matchup cells */}
                                    {matchups.map((row, teamIndex) => (
                                        <ThreatMatrixCell
                                            key={teamIndex}
                                            matchup={row[threatIndex]}
                                            teamPokemon={team[teamIndex].pokemon}
                                            threat={threat}
                                        />
                                    ))}
                                </div>
                            ))}

                            {/* Summary column */}
                            <div className="border-l pl-1 ml-1">
                                <TeamSummaryColumn
                                    matchups={matchups}
                                    team={team}
                                    threats={metaThreats}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <ThreatMatrixLegend mode={mode} />
            </CardContent>

            {/* Threat Detail Modal */}
            <ThreatDetailModal
                pokemon={selectedThreat?.pokemon ?? null}
                types={selectedThreat?.types ?? []}
                usage={selectedThreat?.usage ?? 0}
                format={format}
                open={!!selectedThreat}
                onOpenChange={(open) => !open && setSelectedThreat(null)}
            />
        </Card>
    );
}
