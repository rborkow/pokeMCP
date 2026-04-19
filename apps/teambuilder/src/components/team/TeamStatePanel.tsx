"use client";

import { useState } from "react";
import { AnalysisStrip } from "@/components/analysis/AnalysisStrip";
import { VGCTeamWarnings } from "@/components/analysis/VGCTeamWarnings";
import { PokemonEditDialog } from "@/components/team/PokemonEditDialog";
import { TeamImportExport } from "@/components/team/TeamImportExport";
import { TeamSlotCompact } from "@/components/team/TeamSlotCompact";
import { useHistoryStore } from "@/stores/history-store";
import { useTeamStore } from "@/stores/team-store";
import type { TeamPokemon } from "@/types/pokemon";

const SLOT_KEYS = ["slot-0", "slot-1", "slot-2", "slot-3", "slot-4", "slot-5"] as const;

export interface TeamStatePanelProps {
    defaultImportOpen?: boolean;
}

/**
 * Right-pane wrapper for the chat-first layout: 2×3 compact slots, analysis
 * strip, and the import/export actions. Shares PokemonEditDialog with Grid
 * mode so manual edits work identically.
 */
export function TeamStatePanel({ defaultImportOpen }: TeamStatePanelProps = {}) {
    const team = useTeamStore((s) => s.team);
    const setPokemon = useTeamStore((s) => s.setPokemon);
    const { pushState } = useHistoryStore();
    const [editSlot, setEditSlot] = useState<number | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    const openSlotEditor = (slot: number) => {
        setEditSlot(slot);
        setEditDialogOpen(true);
    };

    const handleSave = (pokemon: TeamPokemon) => {
        if (editSlot === null) return;
        const isNew = editSlot >= team.length || !team[editSlot];
        setPokemon(editSlot, pokemon, "user");

        const nextTeam = [...team];
        if (editSlot < nextTeam.length) nextTeam[editSlot] = pokemon;
        else nextTeam.push(pokemon);
        pushState(
            nextTeam.filter(Boolean),
            isNew ? `Added ${pokemon.pokemon}` : `Updated ${pokemon.pokemon}`,
        );
    };

    const editingPokemon = editSlot !== null ? (team[editSlot] ?? null) : null;

    return (
        <aside className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="signal-mono">Your team · {team.length}/6</div>
                <TeamImportExport defaultImportOpen={defaultImportOpen} />
            </div>

            <div className="grid grid-cols-2 gap-2">
                {SLOT_KEYS.map((key, slot) => (
                    <TeamSlotCompact
                        key={key}
                        slot={slot}
                        pokemon={team[slot] ?? null}
                        onClick={() => openSlotEditor(slot)}
                    />
                ))}
            </div>

            <VGCTeamWarnings />
            <AnalysisStrip />

            <PokemonEditDialog
                pokemon={editingPokemon}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={handleSave}
            />
        </aside>
    );
}
