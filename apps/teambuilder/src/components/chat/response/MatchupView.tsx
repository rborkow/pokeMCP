"use client";

import type { MatchupCard as MatchupCardData } from "@/lib/ai/response-types";

/**
 * Phase 5 placeholder — renders the matchup card's fields in a flat layout.
 * A richer rendering (opponent team preview, per-slot reads) can evolve
 * later without touching the coach's tool schema.
 */
export function MatchupView({ data }: { data: MatchupCardData }) {
    return (
        <div className="chat-first-panel rounded-md p-3 text-[12px] space-y-2">
            <div className="signal-mono">Matchup · {data.opponent}</div>
            <dl className="flex flex-col gap-1">
                {data.winRateEstimate && (
                    <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Win rate estimate</dt>
                        <dd className="font-medium text-foreground">{data.winRateEstimate}</dd>
                    </div>
                )}
                {data.leads && (
                    <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Lead rec</dt>
                        <dd className="font-medium text-foreground">{data.leads}</dd>
                    </div>
                )}
                {data.keyBenchmark && (
                    <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Key benchmark</dt>
                        <dd className="font-medium text-foreground">{data.keyBenchmark}</dd>
                    </div>
                )}
            </dl>
            {data.note && (
                <p className="pt-1 text-[11px] text-muted-foreground/80 border-t border-border/40">
                    {data.note}
                </p>
            )}
        </div>
    );
}
