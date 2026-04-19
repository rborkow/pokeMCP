"use client";

import type { AnalysisHighlightCard } from "@/lib/ai/response-types";

/**
 * Phase 5 placeholder — a single labeled block for one pointed observation.
 */
export function AnalysisHighlight({ data }: { data: AnalysisHighlightCard }) {
    return (
        <div className="chat-first-inset rounded-md p-3 text-[12px] space-y-1">
            <div className="signal-mono">{data.focus}</div>
            <p className="text-[13px] text-foreground leading-relaxed">{data.detail}</p>
        </div>
    );
}
