"use client";

import { Plus } from "lucide-react";

interface TeamSlotEmptyProps {
  slot: number;
  index?: number;
  onClick?: () => void;
}

export function TeamSlotEmpty({ index = 0, onClick }: TeamSlotEmptyProps) {
  return (
    <button
      onClick={onClick}
      className="pokemon-card-empty glow-effect group flex flex-col items-center justify-center min-h-[240px] animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "both" }}
    >
      {/* Pokeball placeholder */}
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center group-hover:border-primary/50 transition-colors">
          <Plus className="w-8 h-8 text-muted-foreground/50 group-hover:text-primary group-hover:scale-110 transition-all" />
        </div>
        <div className="absolute inset-0 rounded-full bg-primary/5 scale-0 group-hover:scale-150 transition-transform opacity-50" />
      </div>

      <span className="font-display font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        Add Pokemon
      </span>
      <span className="text-xs text-muted-foreground/60 mt-1">
        Click to browse
      </span>
    </button>
  );
}
