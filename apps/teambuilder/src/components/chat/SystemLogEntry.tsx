"use client";

import type { SystemLogEntry as SystemLogEntryData } from "@/stores/chat-store";

export interface SystemLogEntryProps {
    entry: SystemLogEntryData;
}

/**
 * Rendered inline between assistant turns. Monospace + muted to read as a
 * system log rather than a user or assistant message — users can see what
 * changed without confusing the attribution.
 */
export function SystemLogEntry({ entry }: SystemLogEntryProps) {
    return (
        <div className="flex items-baseline gap-2 py-1 font-mono text-[11px] text-muted-foreground/80">
            <span aria-hidden>›</span>
            <span>{entry.text}</span>
        </div>
    );
}
