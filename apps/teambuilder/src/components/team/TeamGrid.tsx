"use client";

import { useTeamStore } from "@/stores/team-store";
import { useHistoryStore } from "@/stores/history-store";
import { TeamSlot } from "./TeamSlot";
import { TeamSlotEmpty } from "./TeamSlotEmpty";

interface TeamGridProps {
  onSlotClick?: (slot: number) => void;
}

export function TeamGrid({ onSlotClick }: TeamGridProps) {
  const { team, selectedSlot, setSelectedSlot, removePokemon } = useTeamStore();
  const { pushState } = useHistoryStore();

  const handleSlotClick = (slot: number) => {
    setSelectedSlot(slot);
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

  // Always show 6 slots
  const slots = Array.from({ length: 6 }, (_, i) => ({
    pokemon: team[i] || null,
    slot: i,
  }));

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {slots.map(({ pokemon, slot }) =>
        pokemon ? (
          <TeamSlot
            key={`slot-${slot}`}
            pokemon={pokemon}
            slot={slot}
            isSelected={selectedSlot === slot}
            onSelect={() => handleSlotClick(slot)}
            onRemove={() => handleRemove(slot)}
          />
        ) : (
          <TeamSlotEmpty
            key={`empty-${slot}`}
            slot={slot}
            onClick={() => handleSlotClick(slot)}
          />
        )
      )}
    </div>
  );
}
