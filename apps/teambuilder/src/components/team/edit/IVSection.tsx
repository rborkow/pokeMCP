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

interface IVSectionProps {
    ivs: Partial<BaseStats> | undefined;
    onIVChange: (stat: keyof BaseStats, value: number) => void;
}

export function IVSection({ ivs, onIVChange }: IVSectionProps) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">IVs</label>
            <div className="grid grid-cols-6 gap-2">
                {(Object.keys(STAT_LABELS) as (keyof BaseStats)[]).map((stat) => (
                    <div key={stat} className="space-y-1">
                        <label className="text-xs text-muted-foreground text-center block">
                            {STAT_LABELS[stat]}
                        </label>
                        <Input
                            type="number"
                            min={0}
                            max={31}
                            value={ivs?.[stat] ?? 31}
                            onChange={(e) =>
                                onIVChange(stat, Number.parseInt(e.target.value, 10) || 0)
                            }
                            className="text-center text-sm h-8 px-1"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
