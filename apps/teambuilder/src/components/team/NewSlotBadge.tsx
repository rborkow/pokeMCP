"use client";

import { useEffect, useState } from "react";
import { useTeamStore } from "@/stores/team-store";

const WINDOW_MS = 4000;

export interface NewSlotBadgeProps {
    slot: number;
}

/**
 * Small chip that flashes "NEW · slot N" for {@link WINDOW_MS} after an
 * AI-driven write to this slot. Manual/import edits do NOT flash — those
 * surface as system log entries in the chat instead.
 */
export function NewSlotBadge({ slot }: NewSlotBadgeProps) {
    const lastModifiedAt = useTeamStore((s) => s.lastModifiedAt[slot]);
    const source = useTeamStore((s) => s.lastModificationSource[slot]);
    const [, setTick] = useState(0);

    useEffect(() => {
        if (source !== "ai" || !lastModifiedAt) return;
        const remaining = lastModifiedAt + WINDOW_MS - Date.now();
        if (remaining <= 0) return;
        const id = window.setTimeout(() => setTick((n) => n + 1), remaining);
        return () => window.clearTimeout(id);
    }, [lastModifiedAt, source]);

    if (source !== "ai" || !lastModifiedAt) return null;
    if (Date.now() - lastModifiedAt > WINDOW_MS) return null;

    return (
        <span className="absolute top-1 right-1 rounded-sm bg-emerald-500/15 px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-wider text-emerald-500">
            NEW · slot {slot + 1}
        </span>
    );
}
