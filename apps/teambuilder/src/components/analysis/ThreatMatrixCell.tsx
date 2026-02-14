"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { toDisplayName } from "@/lib/showdown-parser";
import {
	getCombinedColor,
	getDefensiveDescription,
	getOffensiveDescription,
	getOverallAssessment,
	getScoreLabel,
	type MatchupCell,
	type MetaThreat,
} from "@/lib/threat-matrix-utils";

interface ThreatMatrixCellProps {
	matchup: MatchupCell;
	teamPokemon: string;
	threat: MetaThreat;
}

export function ThreatMatrixCell({
	matchup,
	teamPokemon,
	threat,
}: ThreatMatrixCellProps) {
	const defLabel = getScoreLabel(matchup.defScore);
	const offLabel = getScoreLabel(matchup.offScore);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div
					className={`w-10 h-10 flex flex-col items-center justify-center text-[9px] font-bold cursor-help rounded ${getCombinedColor(matchup.defScore, matchup.offScore)} text-white`}
				>
					<span className="leading-tight opacity-90">🛡{defLabel}</span>
					<span className="leading-tight opacity-70">⚔{offLabel}</span>
				</div>
			</TooltipTrigger>
			<TooltipContent side="top" className="max-w-xs">
				<div className="space-y-2">
					<p className="font-semibold border-b pb-1">
						{toDisplayName(teamPokemon)} vs {toDisplayName(threat.pokemon)}
					</p>
					<div className="text-xs space-y-1">
						<p>
							<span className="font-medium">DEF:</span> Takes{" "}
							{getDefensiveDescription(matchup.defScore)}{" "}
							{matchup.attackerTypes.join("/")}
						</p>
						<p>
							<span className="font-medium">OFF:</span> Deals{" "}
							{getOffensiveDescription(matchup.offScore)} to{" "}
							{matchup.attackerTypes.join("/")}
						</p>
					</div>
					<p className="text-xs font-medium text-primary pt-1 border-t">
						{getOverallAssessment(matchup.defScore, matchup.offScore)}
					</p>
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
