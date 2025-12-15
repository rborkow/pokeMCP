"use client";

import { Plus } from "lucide-react";

interface TeamSlotEmptyProps {
  slot: number;
  index?: number;
  onClick?: () => void;
}

export function TeamSlotEmpty({ index = 0, onClick }: TeamSlotEmptyProps) {
  return (
    <div
      className="pokemon-card-empty glow-effect group animate-in fade-in slide-in-from-bottom-2 h-[152px] flex flex-col items-center justify-center gap-2"
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: "both" }}
      onClick={onClick}
    >
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-muted/70 transition-colors">
        <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all duration-300" />
      </div>
      <p className="text-sm text-muted-foreground font-display group-hover:text-foreground transition-colors">Add Pokemon</p>
    </div>
  );
}
