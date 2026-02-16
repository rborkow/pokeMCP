"use client";

import { getModeTips, LEGEND_ENTRIES } from "@/lib/threat-matrix-utils";
import type { Mode } from "@/types/pokemon";

interface ThreatMatrixLegendProps {
	mode: Mode;
}

export function ThreatMatrixLegend({ mode }: ThreatMatrixLegendProps) {
	return (
		<div className="mt-4 space-y-2 text-xs">
			<div className="flex flex-wrap gap-3">
				<span className="text-muted-foreground">Colors:</span>
				{LEGEND_ENTRIES.map((entry) => (
					<div key={entry.label} className="flex items-center gap-1">
						<div className={`w-4 h-4 rounded ${entry.color}`} />
						<span>{entry.label}</span>
					</div>
				))}
			</div>
			<div className="text-muted-foreground">
				🛡=Defense (damage taken) • ⚔=Offense (damage dealt) • ×4=super effective
				• ×2=effective • ×1=neutral • ×½=resisted • ×0=immune
			</div>
			<div className="text-muted-foreground">
				<span className="font-medium">Weighted</span> column: Average score
				weighted by threat usage % (higher usage = more impact)
			</div>
			{/* Mode-specific tips */}
			<div className="mt-3 pt-3 border-t border-border/50">
				<p className="font-medium text-foreground mb-1">
					{mode === "vgc" ? "VGC Tips:" : "Singles Tips:"}
				</p>
				<ul className="list-disc list-inside text-muted-foreground space-y-0.5">
					{getModeTips(mode).map((tip, i) => (
						<li key={i}>{tip}</li>
					))}
				</ul>
			</div>
		</div>
	);
}
