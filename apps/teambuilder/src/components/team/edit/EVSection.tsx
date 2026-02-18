"use client";

import { Input } from "@/components/ui/input";
import type { BaseStats } from "@/types/pokemon";

const STAT_LABELS: Record<keyof BaseStats, string> = {
    hp: "HP",
    atk: "Atk",
    def: "Def",
    spa: "SpA",
    spd: "SpD",
    spe: "Spe",
};

interface EVSectionProps {
    evs: Partial<BaseStats> | undefined;
    evTotal: number;
    onEVChange: (stat: keyof BaseStats, value: number) => void;
}

export function EVSection({ evs, evTotal, onEVChange }: EVSectionProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">EVs</label>
                <span
                    className={`text-xs ${evTotal > 508 ? "text-destructive" : "text-muted-foreground"}`}
                >
                    {evTotal}/508
                </span>
            </div>
            <div className="grid grid-cols-6 gap-2">
                {(Object.keys(STAT_LABELS) as (keyof BaseStats)[]).map((stat) => (
                    <div key={stat} className="space-y-1">
                        <label className="text-xs text-muted-foreground text-center block">
                            {STAT_LABELS[stat]}
                        </label>
                        <Input
                            type="number"
                            min={0}
                            max={252}
                            value={evs?.[stat] || 0}
                            onChange={(e) =>
                                onEVChange(stat, Number.parseInt(e.target.value, 10) || 0)
                            }
                            className="text-center text-sm h-8 px-1"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
