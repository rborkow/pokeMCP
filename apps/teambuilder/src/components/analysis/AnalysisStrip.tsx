"use client";

import { useMemo } from "react";
import { getPokemonTypes } from "@/lib/data/pokemon-types";
import { useTeamStore } from "@/stores/team-store";

type Signal = { label: string; value: string; tone: "neutral" | "good" | "warn" };

const TYPE_WEAKNESSES: Record<string, string[]> = {
    Normal: ["Fighting"],
    Fire: ["Water", "Ground", "Rock"],
    Water: ["Electric", "Grass"],
    Electric: ["Ground"],
    Grass: ["Fire", "Ice", "Poison", "Flying", "Bug"],
    Ice: ["Fire", "Fighting", "Rock", "Steel"],
    Fighting: ["Flying", "Psychic", "Fairy"],
    Poison: ["Ground", "Psychic"],
    Ground: ["Water", "Grass", "Ice"],
    Flying: ["Electric", "Ice", "Rock"],
    Psychic: ["Bug", "Ghost", "Dark"],
    Bug: ["Fire", "Flying", "Rock"],
    Rock: ["Water", "Grass", "Fighting", "Ground", "Steel"],
    Ghost: ["Ghost", "Dark"],
    Dragon: ["Ice", "Dragon", "Fairy"],
    Dark: ["Fighting", "Bug", "Fairy"],
    Steel: ["Fire", "Fighting", "Ground"],
    Fairy: ["Poison", "Steel"],
};

function countSharedWeaknesses(teamTypes: string[][]): number {
    const counts: Record<string, number> = {};
    for (const types of teamTypes) {
        const weaknesses = new Set<string>();
        for (const t of types) {
            for (const w of TYPE_WEAKNESSES[t] ?? []) weaknesses.add(w);
        }
        for (const w of weaknesses) counts[w] = (counts[w] ?? 0) + 1;
    }
    return Object.values(counts).filter((n) => n >= 3).length;
}

function speedShapeLabel(teamSize: number, teamTypes: string[][]): string {
    if (teamSize === 0) return "—";
    const ghostCount = teamTypes.filter((types) => types.includes("Ghost")).length;
    const fightingCount = teamTypes.filter((types) => types.includes("Fighting")).length;
    // Lightweight heuristic for Phase 2; richer speed analysis stays in the
    // SpeedTiers tab for Grid mode.
    if (ghostCount >= 2) return "TR-leaning";
    if (fightingCount >= 2) return "Offense-heavy";
    return "Balanced";
}

/**
 * Condensed 3-signal strip that sits below the compact team panel in
 * chat-first mode. No drill-in — detail lives in Grid mode's full tabs.
 */
export function AnalysisStrip() {
    const team = useTeamStore((s) => s.team);

    const signals: Signal[] = useMemo(() => {
        const filled = team.length;
        const teamTypes = team.map((p) => getPokemonTypes(p.pokemon) as unknown as string[]);
        const sharedWeaks = countSharedWeaknesses(teamTypes);

        return [
            {
                label: "Slots",
                value: `${filled}/6`,
                tone: filled === 6 ? "good" : filled === 0 ? "neutral" : "warn",
            },
            {
                label: "Shared weaks",
                value: filled === 0 ? "—" : `${sharedWeaks}`,
                tone: sharedWeaks === 0 ? "good" : sharedWeaks >= 3 ? "warn" : "neutral",
            },
            {
                label: "Speed shape",
                value: speedShapeLabel(filled, teamTypes),
                tone: "neutral",
            },
        ];
    }, [team]);

    return (
        <div className="chat-first-panel rounded-md px-3 py-2.5">
            <div className="signal-mono mb-2">Analysis</div>
            <ul className="flex flex-col gap-1.5 text-[12px]">
                {signals.map((s) => (
                    <li key={s.label} className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{s.label}</span>
                        <span
                            className={
                                s.tone === "good"
                                    ? "text-emerald-500"
                                    : s.tone === "warn"
                                      ? "text-amber-500"
                                      : "text-foreground"
                            }
                        >
                            {s.value}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
