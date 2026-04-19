"use client";

import { ArrowRight } from "lucide-react";
import type { TeamDiffCard as TeamDiffCardData } from "@/lib/ai/response-types";

export function TeamDiffCard({ data }: { data: TeamDiffCardData }) {
    return (
        <div className="chat-first-panel rounded-md p-3 text-[12px] space-y-2">
            <div className="signal-mono">Team diff</div>
            <p className="text-[13px] text-foreground leading-relaxed">{data.summary}</p>
            <ul className="flex flex-col gap-1.5">
                {data.changes.map((change) => (
                    <li
                        key={`slot-${change.slot}-${change.from ?? ""}-${change.to ?? ""}`}
                        className="flex items-center gap-2 text-muted-foreground"
                    >
                        <span className="font-mono text-[10px] uppercase tracking-wider w-12 shrink-0">
                            slot {change.slot + 1}
                        </span>
                        <span className="font-medium text-foreground/80">{change.from ?? "—"}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                        <span className="font-medium text-emerald-500">{change.to ?? "—"}</span>
                        {change.note && (
                            <span className="ml-auto text-[11px] text-muted-foreground/80 truncate">
                                {change.note}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
