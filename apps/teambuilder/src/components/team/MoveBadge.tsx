"use client";

import { Swords, Sparkles, Shield } from "lucide-react";
import { getMoveData } from "@/lib/data/moves";
import { TYPE_BG_CLASSES } from "@/lib/data/type-colors";
import type { LucideIcon } from "lucide-react";

// Category icons
const CATEGORY_ICONS: Record<string, LucideIcon> = {
    Physical: Swords,
    Special: Sparkles,
    Status: Shield,
};

interface MoveBadgeProps {
    move: string;
}

export function MoveBadge({ move }: MoveBadgeProps) {
    const moveData = getMoveData(move);

    // Fallback for unknown moves
    if (!moveData) {
        return (
            <div className="move-badge bg-muted/30 border-border/30 text-[10px] sm:text-[11px]">
                <span className="truncate">{move}</span>
            </div>
        );
    }

    const typeClass = TYPE_BG_CLASSES[moveData.type as keyof typeof TYPE_BG_CLASSES] || "bg-muted";
    const Icon = CATEGORY_ICONS[moveData.category];

    return (
        <div className={`move-badge ${typeClass} text-[10px] sm:text-[11px] py-1 sm:py-1.5`}>
            {Icon && <Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 opacity-80" />}
            <span className="truncate">{move}</span>
        </div>
    );
}
