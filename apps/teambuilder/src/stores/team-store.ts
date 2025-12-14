import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TeamPokemon, FormatId } from "@/types/pokemon";
import { parseShowdownTeam, exportShowdownTeam } from "@/lib/showdown-parser";
import { decodeTeamFromUrl } from "@/lib/share";

interface TeamState {
  format: FormatId;
  team: TeamPokemon[];
  selectedSlot: number | null;

  // Actions
  setFormat: (format: FormatId) => void;
  setPokemon: (slot: number, pokemon: TeamPokemon) => void;
  removePokemon: (slot: number) => void;
  swapSlots: (from: number, to: number) => void;
  importTeam: (showdownText: string) => { success: boolean; error?: string };
  exportTeam: () => string;
  clearTeam: () => void;
  setSelectedSlot: (slot: number | null) => void;
  loadFromUrlParam: (encoded: string) => boolean;
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      format: "gen9ou",
      team: [],
      selectedSlot: null,

      setFormat: (format) => set({ format }),

      setPokemon: (slot, pokemon) => {
        set((state) => {
          const newTeam = [...state.team];
          // Extend array if needed
          while (newTeam.length <= slot) {
            newTeam.push(null as unknown as TeamPokemon);
          }
          newTeam[slot] = pokemon;
          // Remove null slots from the end
          while (newTeam.length > 0 && newTeam[newTeam.length - 1] === null) {
            newTeam.pop();
          }
          return { team: newTeam.filter(Boolean) };
        });
      },

      removePokemon: (slot) => {
        set((state) => {
          const newTeam = state.team.filter((_, i) => i !== slot);
          return { team: newTeam, selectedSlot: null };
        });
      },

      swapSlots: (from, to) => {
        set((state) => {
          const newTeam = [...state.team];
          [newTeam[from], newTeam[to]] = [newTeam[to], newTeam[from]];
          return { team: newTeam };
        });
      },

      importTeam: (showdownText) => {
        try {
          const team = parseShowdownTeam(showdownText);
          if (team.length === 0) {
            return { success: false, error: "Could not parse any Pokemon from the input" };
          }
          if (team.length > 6) {
            return { success: false, error: "Team cannot have more than 6 Pokemon" };
          }
          set({ team });
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to parse team",
          };
        }
      },

      exportTeam: () => {
        const { team } = get();
        return exportShowdownTeam(team);
      },

      clearTeam: () => set({ team: [], selectedSlot: null }),

      setSelectedSlot: (slot) => set({ selectedSlot: slot }),

      loadFromUrlParam: (encoded) => {
        const result = decodeTeamFromUrl(encoded);
        if (result && result.team.length > 0) {
          set({
            team: result.team,
            format: result.format as FormatId,
            selectedSlot: null,
          });
          return true;
        }
        return false;
      },
    }),
    {
      name: "pokemcp-team",
      partialize: (state) => ({ format: state.format, team: state.team }),
    }
  )
);
