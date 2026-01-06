"use client";

import type { BaseStats } from "@/types/pokemon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Stat colors for the EV bar segments
const STAT_COLORS: Record<string, string> = {
  hp: "bg-red-500",
  atk: "bg-orange-500",
  def: "bg-yellow-500",
  spa: "bg-blue-500",
  spd: "bg-green-500",
  spe: "bg-pink-500",
};

const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

interface EVBarProps {
  evs: Partial<BaseStats>;
  nature?: string;
}

export function EVBar({ evs, nature }: EVBarProps) {
  // Filter to only stats with EVs allocated
  const activeStats = Object.entries(evs)
    .filter(([_, val]) => val && val > 0)
    .map(([stat, val]) => ({ stat, value: val as number }));

  // Calculate total for percentages
  const total = activeStats.reduce((sum, { value }) => sum + value, 0);

  // Don't render if no EVs
  if (total === 0) return null;

  // Build tooltip text
  const evText = activeStats
    .map(({ stat, value }) => `${value} ${STAT_LABELS[stat]}`)
    .join(" / ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-2 rounded-full overflow-hidden flex bg-muted/30">
            {activeStats.map(({ stat, value }) => (
              <div
                key={stat}
                className={`${STAT_COLORS[stat]} transition-all duration-300`}
                style={{ width: `${(value / total) * 100}%` }}
              />
            ))}
          </div>
          {nature && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {nature}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">
          <span className="font-medium">EVs:</span> {evText}
          {nature && (
            <>
              <br />
              <span className="font-medium">Nature:</span> {nature}
            </>
          )}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
