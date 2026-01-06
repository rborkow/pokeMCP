"use client";

import { Swords, Sparkles, Shield } from "lucide-react";
import { getMoveData } from "@/lib/data/moves";
import type { LucideIcon } from "lucide-react";

// Reuse Pokemon type colors for move types
const TYPE_COLORS: Record<string, string> = {
  Normal: "bg-pokemon-normal",
  Fire: "bg-pokemon-fire",
  Water: "bg-pokemon-water",
  Electric: "bg-pokemon-electric text-black",
  Grass: "bg-pokemon-grass",
  Ice: "bg-pokemon-ice text-black",
  Fighting: "bg-pokemon-fighting",
  Poison: "bg-pokemon-poison",
  Ground: "bg-pokemon-ground",
  Flying: "bg-pokemon-flying text-black",
  Psychic: "bg-pokemon-psychic",
  Bug: "bg-pokemon-bug",
  Rock: "bg-pokemon-rock",
  Ghost: "bg-pokemon-ghost",
  Dragon: "bg-pokemon-dragon",
  Dark: "bg-pokemon-dark",
  Steel: "bg-pokemon-steel",
  Fairy: "bg-pokemon-fairy text-black",
};

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

  const typeClass = TYPE_COLORS[moveData.type] || "bg-muted";
  const Icon = CATEGORY_ICONS[moveData.category];

  return (
    <div className={`move-badge ${typeClass} text-[10px] sm:text-[11px] py-1 sm:py-1.5`}>
      {Icon && <Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 opacity-80" />}
      <span className="truncate">{move}</span>
    </div>
  );
}
