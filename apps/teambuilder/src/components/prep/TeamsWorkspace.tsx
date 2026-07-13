"use client";

import { Download, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PokemonLineup } from "@/components/prep/PokemonLineup";
import { createTeamSnapshot } from "@/lib/prep/schema";
import { DEFAULT_CHAMPIONS_FORMAT } from "@/lib/prep/capabilities";
import { usePrepStore } from "@/stores/prep-store";
import { useTeamStore } from "@/stores/team-store";

export function TeamsWorkspace() {
    const currentTeam = useTeamStore((state) => state.team);
    const format = useTeamStore((state) => state.format);
    const teams = usePrepStore((state) => state.teams);
    const plans = usePrepStore((state) => state.plans);
    const saveTeam = usePrepStore((state) => state.saveTeam);
    const removeTeam = usePrepStore((state) => state.removeTeam);
    const removePlan = usePrepStore((state) => state.removePlan);
    const exportWorkspace = usePrepStore((state) => state.exportWorkspace);
    const [name, setName] = useState("My Champions team");

    function saveCurrent() {
        if (!currentTeam.length) return;
        saveTeam(
            createTeamSnapshot(
                name.trim() || "My Champions team",
                format.startsWith("champions-") ? format : DEFAULT_CHAMPIONS_FORMAT,
                currentTeam,
            ),
        );
    }

    function downloadWorkspace() {
        const blob = new Blob([exportWorkspace()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `pokemcp-prep-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="space-y-12">
            <section aria-labelledby="current-team-heading">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h2 id="current-team-heading" className="text-xl font-semibold">Current builder team</h2>
                        <p className="mt-2 text-sm text-muted-foreground">The existing builder remains the editing surface. Save named snapshots here for prep.</p>
                    </div>
                    <Link href="/build?mode=grid" className="prep-button-secondary"><Plus className="h-4 w-4" /> Edit in builder</Link>
                </div>
                <div className="mt-5 rounded-lg border border-border bg-panel p-5">
                    {currentTeam.length ? <PokemonLineup team={currentTeam} /> : <p className="text-sm text-muted-foreground">No Pokémon in the current builder team.</p>}
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <label className="sr-only" htmlFor="snapshot-name">Snapshot name</label>
                        <input id="snapshot-name" value={name} onChange={(event) => setName(event.target.value)} className="prep-field" maxLength={120} />
                        <button type="button" onClick={saveCurrent} disabled={!currentTeam.length} className="prep-button-primary justify-center whitespace-nowrap disabled:opacity-50">Save snapshot</button>
                    </div>
                </div>
            </section>

            <section aria-labelledby="saved-teams-heading">
                <h2 id="saved-teams-heading" className="text-xl font-semibold">Saved teams</h2>
                {teams.length ? (
                    <div className="mt-5 divide-y divide-border border-y border-border">
                        {teams.map((team) => (
                            <div key={team.id} className="grid gap-4 py-5 lg:grid-cols-[220px_1fr_auto] lg:items-center">
                                <div><p className="font-medium">{team.name}</p><p className="mt-1 text-xs text-muted-foreground">{team.format} · {team.pokemon.length}/6</p></div>
                                <PokemonLineup team={team.pokemon} compact />
                                <button type="button" onClick={() => removeTeam(team.id)} className="prep-button-secondary justify-center text-rust" aria-label={`Delete ${team.name}`}><Trash2 className="h-4 w-4" /> Delete</button>
                            </div>
                        ))}
                    </div>
                ) : <p className="mt-5 border-y border-border py-6 text-sm text-muted-foreground">No saved team snapshots yet.</p>}
            </section>

            <section aria-labelledby="plans-heading">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div><h2 id="plans-heading" className="text-xl font-semibold">Prep plans</h2><p className="mt-2 text-sm text-muted-foreground">Plans are stored in this browser until you sign in and sync.</p></div>
                    <Link href="/prep/new" className="prep-button-primary">New prep</Link>
                </div>
                {plans.length ? (
                    <div className="mt-5 divide-y divide-border border-y border-border">
                        {[...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((plan) => (
                            <div key={plan.id} className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center">
                                <Link href={`/prep/${plan.id}`} className="group rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><span className="font-medium group-hover:text-primary">{plan.ownTeam.name} into {plan.opponentTeam.name}</span><span className="mt-1 block text-xs text-muted-foreground">Updated {new Date(plan.updatedAt).toLocaleString()}</span></Link>
                                <button type="button" onClick={() => removePlan(plan.id)} className="prep-button-secondary justify-center text-rust"><Trash2 className="h-4 w-4" /> Delete</button>
                            </div>
                        ))}
                    </div>
                ) : <p className="mt-5 border-y border-border py-6 text-sm text-muted-foreground">No prep plans yet.</p>}
            </section>

            <section className="border-t border-border pt-8" aria-labelledby="backup-heading">
                <h2 id="backup-heading" className="text-xl font-semibold">Local backup</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Download teams, plans, and coach history as JSON before clearing browser data or moving devices.</p>
                <button type="button" onClick={downloadWorkspace} className="prep-button-secondary mt-5"><Download className="h-4 w-4" /> Download workspace JSON</button>
            </section>
        </div>
    );
}
