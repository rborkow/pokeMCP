"use client";

import { useMemo } from "react";
import {
    getActiveMegaForm,
    getActiveMegaSlot,
    getEffectiveTypes,
} from "@/lib/champions-utils";
import { getPokemonBaseStats } from "@/lib/data/pokemon-types";
import { calculateSpeed } from "@/lib/speed-calc";
import { analyzeTeamCoverage } from "@/lib/type-analysis";
import { useTeamStore } from "@/stores/team-store";

type Signal = { label: string; value: string; tone: "neutral" | "good" | "warn" };

function speedShapeFromTeam(
    team: ReturnType<typeof useTeamStore.getState>["team"],
): string {
    if (team.length === 0) return "—";
    const speeds: number[] = [];
    for (const mon of team) {
        const computed = calculateSpeed(mon);
        if (computed !== null) {
            speeds.push(computed);
            continue;
        }
        // Fall back to base speed if we can't compute (e.g., missing EV/nature data).
        const base = getPokemonBaseStats(mon.pokemon);
        if (base) speeds.push(base.spe);
    }
    if (speeds.length === 0) return "—";
    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    if (avg >= 260) return "Hyper offense";
    if (avg >= 200) return "Offense-leaning";
    if (avg >= 140) return "Balanced";
    if (avg >= 90) return "Bulky";
    return "TR-leaning";
}

/**
 * Condensed 3-signal strip that sits below the compact team panel in
 * chat-first mode. Reads from the same analysis primitives the full Grid
 * mode tabs use (`analyzeTeamCoverage`, `calculateSpeed`) so the numbers
 * are truthful rather than heuristic.
 */
export function AnalysisStrip() {
    const { team, format } = useTeamStore();

    const signals: Signal[] = useMemo(() => {
        const filled = team.length;

        if (filled === 0) {
            return [
                { label: "Slots", value: "0/6", tone: "neutral" },
                { label: "Shared weaks", value: "—", tone: "neutral" },
                { label: "Speed shape", value: "—", tone: "neutral" },
            ];
        }

        const activeMega = getActiveMegaForm(team, format);
        const activeMegaSlot = getActiveMegaSlot(team, format);
        const teamData = team.map((p, i) => ({
            name:
                i === activeMegaSlot && activeMega
                    ? `${p.pokemon} (as ${activeMega.megaName})`
                    : p.pokemon,
            types: getEffectiveTypes(p, team, format),
        }));
        const analysis = analyzeTeamCoverage(teamData);
        const sharedWeaks = analysis.weaknesses.filter((w) => w.count >= 3).length;
        const topWeakness = analysis.weaknesses[0];

        return [
            {
                label: "Slots",
                value: `${filled}/6`,
                tone: filled === 6 ? "good" : "warn",
            },
            {
                label: "Shared weaks",
                value:
                    sharedWeaks === 0
                        ? "0"
                        : topWeakness
                          ? `${sharedWeaks} · ${topWeakness.type} (${topWeakness.count})`
                          : `${sharedWeaks}`,
                tone: sharedWeaks === 0 ? "good" : sharedWeaks >= 3 ? "warn" : "neutral",
            },
            {
                label: "Speed shape",
                value: speedShapeFromTeam(team),
                tone: "neutral",
            },
        ];
    }, [team, format]);

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
