"use client";

import { parseResponseCard } from "@/lib/ai/response-types";
import { AnalysisHighlight } from "./AnalysisHighlight";
import { DataCard } from "./DataCard";
import { MatchupView } from "./MatchupView";
import { TeamDiffCard } from "./TeamDiffCard";

export function ResponseDispatcher({ card }: { card: unknown }) {
    const parsed = parseResponseCard(card);
    if (!parsed) {
        // Gracefully degrade — don't render malformed cards. The coach's
        // prose reply still lands in the transcript.
        return null;
    }

    switch (parsed.kind) {
        case "data":
            return <DataCard data={parsed} />;
        case "team_diff":
            return <TeamDiffCard data={parsed} />;
        case "matchup":
            return <MatchupView data={parsed} />;
        case "analysis_highlight":
            return <AnalysisHighlight data={parsed} />;
    }
}
