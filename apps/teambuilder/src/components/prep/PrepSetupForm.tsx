"use client";

import { AlertCircle, ArrowRight, FileText, ListPlus, Newspaper } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PokemonLineup } from "@/components/prep/PokemonLineup";
import { exportShowdownTeam, parseShowdownTeam } from "@/lib/showdown-parser";
import {
    createTeamSnapshot,
    MAX_TEAM_PASTE_BYTES,
    PREP_MECHANICS_VERSION,
    PrepPlanSchema,
    type OpponentSource,
    type TeamSnapshot,
} from "@/lib/prep/schema";
import { getWorkspaceId } from "@/lib/prep/workspace-id";
import { trackPrepEvent } from "@/lib/prep/analytics";
import { DEFAULT_CHAMPIONS_FORMAT } from "@/lib/prep/capabilities";
import { usePrepStore } from "@/stores/prep-store";
import { useTeamStore } from "@/stores/team-store";
import type { TeamPokemon } from "@/types/pokemon";

type OpponentMode = "event" | "paste" | "manual";

export interface SelectedOpponent {
    team: TeamSnapshot;
    source: OpponentSource;
}

function manualTeam(value: string): TeamPokemon[] {
    return value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 6)
        .map((pokemon) => ({ pokemon, moves: [] }));
}

export function PrepSetupForm({ selectedOpponent }: { selectedOpponent?: SelectedOpponent }) {
    const router = useRouter();
    const currentTeam = useTeamStore((state) => state.team);
    const currentFormat = useTeamStore((state) => state.format);
    const savedTeams = usePrepStore((state) => state.teams);
    const saveTeam = usePrepStore((state) => state.saveTeam);
    const savePlan = usePrepStore((state) => state.savePlan);
    const [ownTeamId, setOwnTeamId] = useState("current");
    const [mode, setMode] = useState<OpponentMode>(selectedOpponent ? "event" : "paste");
    const [paste, setPaste] = useState("");
    const [manual, setManual] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const ownTeam = useMemo(() => {
        if (ownTeamId === "current") return currentTeam;
        return savedTeams.find((team) => team.id === ownTeamId)?.pokemon ?? [];
    }, [currentTeam, ownTeamId, savedTeams]);

    function editIndexedTeam() {
        if (!selectedOpponent) return;
        setPaste(exportShowdownTeam(selectedOpponent.team.pokemon));
        setMode("paste");
    }

    async function generatePlan() {
        setError(null);
        if (ownTeam.length < 4) {
            setError("Add at least four Pokémon to your team before preparing a matchup.");
            return;
        }

        let opponentTeam: TeamSnapshot;
        let opponentSource: OpponentSource;
        try {
            if (mode === "event" && selectedOpponent) {
                opponentTeam = selectedOpponent.team;
                opponentSource = selectedOpponent.source;
            } else if (mode === "paste") {
                if (new Blob([paste]).size > MAX_TEAM_PASTE_BYTES) {
                    throw new Error("The pasted team is larger than 32 KB.");
                }
                const parsed = parseShowdownTeam(paste);
                if (parsed.length < 4) throw new Error("Paste at least four complete team blocks.");
                opponentTeam = createTeamSnapshot(
                    "Pasted opponent",
                    DEFAULT_CHAMPIONS_FORMAT,
                    parsed,
                );
                opponentSource = { kind: "paste", raw: paste };
            } else {
                const parsed = manualTeam(manual);
                if (parsed.length < 4) throw new Error("Enter at least four Pokémon, one per line.");
                opponentTeam = createTeamSnapshot(
                    "Manually entered opponent",
                    DEFAULT_CHAMPIONS_FORMAT,
                    parsed,
                );
                opponentSource = { kind: "manual" };
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "The opponent team could not be read.");
            return;
        }

        const selectedSaved = savedTeams.find((team) => team.id === ownTeamId);
        const ownSnapshot =
            selectedSaved ??
            createTeamSnapshot(
                "My Champions team",
                currentFormat.startsWith("champions-") ? currentFormat : DEFAULT_CHAMPIONS_FORMAT,
                ownTeam,
                { id: "current-workspace-team" },
            );

        setIsGenerating(true);
        trackPrepEvent("prep_started", { format: DEFAULT_CHAMPIONS_FORMAT, source: opponentSource.kind });
        try {
            const response = await fetch("/api/prep/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Prep-Workspace": getWorkspaceId(),
                },
                body: JSON.stringify({ ownTeam: ownSnapshot, opponentTeam, opponentSource }),
            });
            const result = (await response.json()) as { battleCard?: unknown; error?: string };
            if (!response.ok || !result.battleCard) {
                throw new Error(result.error ?? "The battle card could not be generated.");
            }
            const now = new Date().toISOString();
            const plan = PrepPlanSchema.parse({
                id: crypto.randomUUID(),
                format: DEFAULT_CHAMPIONS_FORMAT,
                ownTeam: ownSnapshot,
                opponentTeam,
                opponentSource,
                battleCard: result.battleCard,
                mechanicsVersion: PREP_MECHANICS_VERSION,
                status: "complete",
                createdAt: now,
                updatedAt: now,
            });
            saveTeam(ownSnapshot);
            savePlan(plan);
            trackPrepEvent("prep_generated", { format: plan.format, source: opponentSource.kind });
            router.push(`/prep/${plan.id}`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "The battle card could not be generated.");
            setIsGenerating(false);
        }
    }

    return (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
            <section aria-labelledby="own-team-heading">
                <p className="text-sm text-muted-foreground">Step 1</p>
                <h2 id="own-team-heading" className="mt-1 text-xl font-semibold">Choose your team</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">The plan is grounded in the moves and items you have entered. You can keep using the builder for incomplete sets.</p>
                <label htmlFor="own-team" className="mt-6 block text-sm font-medium">Team</label>
                <select id="own-team" className="prep-field mt-2" value={ownTeamId} onChange={(event) => setOwnTeamId(event.target.value)}>
                    <option value="current">Current builder team ({currentTeam.length}/6)</option>
                    {savedTeams.filter((team) => team.id !== "current-workspace-team").map((team) => (
                        <option key={team.id} value={team.id}>{team.name} ({team.pokemon.length}/6)</option>
                    ))}
                </select>
                <div className="mt-4 min-h-28 rounded-lg border border-border bg-panel p-4">
                    {ownTeam.length ? (
                        <PokemonLineup team={ownTeam} />
                    ) : (
                        <div>
                            <p className="text-sm font-medium">No current team yet.</p>
                            <p className="mt-1 text-sm text-muted-foreground">Import a Showdown paste or build a team before starting prep.</p>
                        </div>
                    )}
                </div>
                <Link href="/build?start=import&mode=grid" className="prep-text-link mt-4">Open team builder <ArrowRight className="h-4 w-4" /></Link>
            </section>

            <section aria-labelledby="opponent-heading">
                <p className="text-sm text-muted-foreground">Step 2</p>
                <h2 id="opponent-heading" className="mt-1 text-xl font-semibold">Add the opposing team</h2>
                <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Opponent input">
                    {selectedOpponent && (
                        <button type="button" role="tab" aria-selected={mode === "event"} onClick={() => setMode("event")} className={mode === "event" ? "prep-button-primary" : "prep-button-secondary"}>
                            <Newspaper className="h-4 w-4" /> Indexed team
                        </button>
                    )}
                    <button type="button" role="tab" aria-selected={mode === "paste"} onClick={() => setMode("paste")} className={mode === "paste" ? "prep-button-primary" : "prep-button-secondary"}>
                        <FileText className="h-4 w-4" /> Paste team
                    </button>
                    <button type="button" role="tab" aria-selected={mode === "manual"} onClick={() => setMode("manual")} className={mode === "manual" ? "prep-button-primary" : "prep-button-secondary"}>
                        <ListPlus className="h-4 w-4" /> Names only
                    </button>
                </div>

                {mode === "event" && selectedOpponent && (
                    <div className="mt-5 rounded-lg border border-border bg-panel p-5">
                        <p className="font-medium">{selectedOpponent.team.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{selectedOpponent.team.sourceLabel}</p>
                        <div className="mt-4"><PokemonLineup team={selectedOpponent.team.pokemon} /></div>
                        <button type="button" onClick={editIndexedTeam} className="prep-text-link mt-4">Edit missing or incorrect details</button>
                    </div>
                )}
                {mode === "paste" && (
                    <div className="mt-5">
                        <label htmlFor="opponent-paste" className="text-sm font-medium">Showdown-style team paste</label>
                        <textarea id="opponent-paste" value={paste} onChange={(event) => setPaste(event.target.value)} rows={15} maxLength={MAX_TEAM_PASTE_BYTES} className="prep-field mt-2 resize-y font-mono text-xs leading-5" placeholder={"Charizard @ Charizardite Y\nAbility: Blaze\nTimid Nature\n- Heat Wave\n- Solar Beam\n- Weather Ball\n- Protect"} />
                        <p className="mt-2 text-xs text-muted-foreground">Up to 32 KB. Nicknames stay on this device unless you sign in and sync.</p>
                    </div>
                )}
                {mode === "manual" && (
                    <div className="mt-5">
                        <label htmlFor="opponent-manual" className="text-sm font-medium">Pokémon names, one per line</label>
                        <textarea id="opponent-manual" value={manual} onChange={(event) => setManual(event.target.value)} rows={8} className="prep-field mt-2 resize-y" placeholder={"Charizard\nVenusaur\nFarigiraf\nScrafty\nSylveon\nGarchomp"} />
                        <p className="mt-2 text-xs text-ochre">Advice will be broader when moves and items are unknown.</p>
                    </div>
                )}

                {error && (
                    <div role="alert" className="mt-5 flex gap-3 rounded-md border border-rust/40 bg-rust/10 p-4 text-sm text-rust">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{error}</span>
                    </div>
                )}
                <button type="button" onClick={generatePlan} disabled={isGenerating} className="prep-button-primary mt-6 min-w-48 justify-center disabled:cursor-not-allowed disabled:opacity-60">
                    {isGenerating ? "Building battle card…" : "Build battle card"}
                    {!isGenerating && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>
            </section>
        </div>
    );
}
