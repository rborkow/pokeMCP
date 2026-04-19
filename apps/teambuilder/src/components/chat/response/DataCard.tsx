"use client";

import type { DataCard as DataCardData } from "@/lib/ai/response-types";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<NonNullable<DataCardData["rows"][number]["tone"]>, string> = {
    neutral: "text-foreground",
    good: "text-emerald-500",
    warn: "text-amber-500",
    bad: "text-rose-500",
};

export function DataCard({ data }: { data: DataCardData }) {
    return (
        <div className="chat-first-panel rounded-md p-3 text-[12px] space-y-2">
            <div className="signal-mono">{data.title}</div>
            <dl className="flex flex-col gap-1">
                {data.rows.map((row) => (
                    <div
                        key={`${row.label}-${row.value}`}
                        className="flex items-baseline justify-between gap-3"
                    >
                        <dt className="text-muted-foreground">{row.label}</dt>
                        <dd className={cn(TONE_CLASSES[row.tone ?? "neutral"], "font-medium")}>
                            {row.value}
                        </dd>
                    </div>
                ))}
            </dl>
            {data.note && (
                <p className="pt-1 text-[11px] text-muted-foreground/80 border-t border-border/40">
                    {data.note}
                </p>
            )}
        </div>
    );
}
