"use client";

import { useState } from "react";
import { useTeamStore } from "@/stores/team-store";
import { useHistoryStore } from "@/stores/history-store";
import { TeamSlot } from "./TeamSlot";
import { TeamSlotEmpty } from "./TeamSlotEmpty";
import { PokemonEditDialog } from "./PokemonEditDialog";
import { BringFourSelector } from "./BringFourSelector";
import type { TeamPokemon } from "@/types/pokemon";

interface TeamGridProps {
  onSlotClick?: (slot: number) => void;
}

export function TeamGrid({ onSlotClick }: TeamGridProps) {
  const { team, selectedSlot, setSelectedSlot, removePokemon, setPokemon, mode } = useTeamStore();
  const { pushState } = useHistoryStore();
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleSlotClick = (slot: number) => {
    setSelectedSlot(slot);
    setEditSlot(slot);
    setEditDialogOpen(true);
    onSlotClick?.(slot);
  };

  const handleRemove = (slot: number) => {
    const pokemonName = team[slot]?.pokemon;
    removePokemon(slot);
    pushState(
      team.filter((_, i) => i !== slot),
      `Removed ${pokemonName}`
    );
  };

  const handleSave = (pokemon: TeamPokemon) => {
    if (editSlot === null) return;

    const isNew = editSlot >= team.length || !team[editSlot];
    setPokemon(editSlot, pokemon);

    // Push to history
    const newTeam = [...team];
    if (editSlot < newTeam.length) {
      newTeam[editSlot] = pokemon;
    } else {
      newTeam.push(pokemon);
    }
    pushState(
      newTeam.filter(Boolean),
      isNew ? `Added ${pokemon.pokemon}` : `Updated ${pokemon.pokemon}`
    );
  };

  // Always show 6 slots
  const slots = Array.from({ length: 6 }, (_, i) => ({
    pokemon: team[i] || null,
    slot: i,
  }));

  const editingPokemon = editSlot !== null ? team[editSlot] || null : null;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {slots.map(({ pokemon, slot }, index) =>
          pokemon ? (
            <TeamSlot
              key={`slot-${slot}`}
              pokemon={pokemon}
              slot={slot}
              index={index}
              isSelected={selectedSlot === slot}
              onSelect={() => handleSlotClick(slot)}
              onRemove={() => handleRemove(slot)}
            />
          ) : (
            <TeamSlotEmpty
              key={`empty-${slot}`}
              slot={slot}
              index={index}
              onClick={() => handleSlotClick(slot)}
            />
          )
        )}
      </div>

      {/* VGC: Bring 4 Selector */}
      {mode === "vgc" && <BringFourSelector team={team} />}

      <PokemonEditDialog
        pokemon={editingPokemon}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSave}
      />
    </>
  );
}
