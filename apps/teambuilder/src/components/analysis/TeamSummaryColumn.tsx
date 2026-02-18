"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toDisplayName } from "@/lib/showdown-parser";
import { getCombinedColor, type MatchupCell, type MetaThreat } from "@/lib/threat-matrix-utils";

interface TeamSummaryColumnProps {
    matchups: MatchupCell[][];
    team: { pokemon: string }[];
    threats: MetaThreat[];
}

export function TeamSummaryColumn({ matchups, team, threats }: TeamSummaryColumnProps) {
    // Calculate usage-weighted average combined score (def + off) for each team member
    // Higher usage threats have more impact on the score
    const teamMemberAverages = matchups.map((row) => {
        let weightedSum = 0;
        let totalWeight = 0;

        row.forEach((cell, threatIndex) => {
            if (cell.defScore !== null && cell.offScore !== null) {
                const combined = (cell.defScore + cell.offScore) / 2;
                const weight = threats[threatIndex]?.usage ?? 1;
                weightedSum += combined * weight;
                totalWeight += weight;
            }
        });

        return totalWeight > 0 ? weightedSum / totalWeight : null;
    });

    return (
        <div className="flex flex-col gap-1">
            <div className="h-10 flex items-center justify-center text-[9px] font-medium text-muted-foreground">
                Weighted
            </div>
            {teamMemberAverages.map((avg, i) => (
                <Tooltip key={i}>
                    <TooltipTrigger asChild>
                        <div
                            className={`w-10 h-10 flex items-center justify-center text-xs font-bold rounded text-white ${avg !== null ? getCombinedColor(avg, avg) : "bg-gray-400/50 text-gray-400"}`}
                        >
                            {avg !== null ? avg.toFixed(1) : "?"}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="font-medium">{toDisplayName(team[i].pokemon)}</p>
                        <p className="text-xs text-muted-foreground">
                            {avg !== null ? "Usage-weighted matchup score" : "(unknown types)"}
                        </p>
                        {avg !== null && (
                            <p className="text-xs mt-1">
                                {avg >= 1
                                    ? "Strong vs meta"
                                    : avg >= 0
                                      ? "Neutral vs meta"
                                      : "Weak vs meta"}
                            </p>
                        )}
                    </TooltipContent>
                </Tooltip>
            ))}
        </div>
    );
}
