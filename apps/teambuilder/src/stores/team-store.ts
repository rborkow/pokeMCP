import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TeamPokemon, FormatId, Mode } from "@/types/pokemon";
import { MODE_INFO, isFormatValidForMode } from "@/types/pokemon";
import { parseShowdownTeam, exportShowdownTeam } from "@/lib/showdown-parser";
import { decodeTeamFromUrl } from "@/lib/share";

/**
 * Normalize Pokemon name for Species Clause comparison
 * Handles forms like "Landorus-Therian" -> "landorus" (base species)
 * But keeps distinct species like "Urshifu-Rapid-Strike" separate from "Urshifu"
 */
function normalizeSpeciesName(name: string): string {
  const lower = name.toLowerCase().trim();
  // Forms that count as the same species for Species Clause
  // (most regional forms, megas, etc. share the base species)
  const formSuffixes = [
    "-therian", "-incarnate", "-mega", "-mega-x", "-mega-y",
    "-alola", "-galar", "-hisui", "-paldea",
    "-origin", "-altered", "-sky", "-land",
    "-heat", "-wash", "-frost", "-fan", "-mow",
    "-black", "-white", "-resolute", "-pirouette", "-aria",
    "-dusk", "-midnight", "-dusk-mane", "-dawn-wings", "-ultra",
    "-crowned", "-ice", "-shadow", "-hero",
    "-single-strike", "-rapid-strike",
    "-bloodmoon", "-cornerstone", "-hearthflame", "-wellspring",
  ];

  for (const suffix of formSuffixes) {
    if (lower.endsWith(suffix)) {
      return lower.slice(0, -suffix.length);
    }
  }
  return lower;
}

/**
 * Check if adding a Pokemon would violate Species Clause
 */
function wouldViolateSpeciesClause(
  team: TeamPokemon[],
  newPokemon: string,
  excludeSlot?: number
): boolean {
  const newSpecies = normalizeSpeciesName(newPokemon);
  return team.some((p, i) => {
    if (excludeSlot !== undefined && i === excludeSlot) return false;
    return p && normalizeSpeciesName(p.pokemon) === newSpecies;
  });
}

interface TeamState {
  mode: Mode;
  format: FormatId;
  team: TeamPokemon[];
  selectedSlot: number | null;

  // Actions
  setMode: (mode: Mode) => void;
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
      mode: "singles",
      format: "gen9ou",
      team: [],
      selectedSlot: null,

      setMode: (mode) => {
        const currentFormat = get().format;
        // If current format is valid for new mode, keep it; otherwise use default
        const newFormat = isFormatValidForMode(currentFormat, mode)
          ? currentFormat
          : MODE_INFO[mode].defaultFormat;
        set({ mode, format: newFormat });
      },

      setFormat: (format) => {
        // Derive mode from format to keep them in sync
        const mode: Mode = isFormatValidForMode(format, "vgc") ? "vgc" : "singles";
        set({ format, mode });
      },

      setPokemon: (slot, pokemon) => {
        set((state) => {
          // Check Species Clause - warn but still allow (AI should prevent this)
          if (wouldViolateSpeciesClause(state.team, pokemon.pokemon, slot)) {
            console.warn(
              `Species Clause violation: ${pokemon.pokemon} is already on the team. ` +
              `This should not happen - check AI prompt rules.`
            );
          }

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

          // Check for Species Clause violations
          const seenSpecies = new Set<string>();
          const duplicates: string[] = [];
          for (const pokemon of team) {
            const species = normalizeSpeciesName(pokemon.pokemon);
            if (seenSpecies.has(species)) {
              duplicates.push(pokemon.pokemon);
            }
            seenSpecies.add(species);
          }

          if (duplicates.length > 0) {
            return {
              success: false,
              error: `Species Clause violation: duplicate Pokemon (${duplicates.join(", ")})`,
            };
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
          const format = result.format as FormatId;
          // Detect mode from format
          const mode: Mode = isFormatValidForMode(format, "vgc") ? "vgc" : "singles";
          set({
            team: result.team,
            format,
            mode,
            selectedSlot: null,
          });
          return true;
        }
        return false;
      },
    }),
    {
      name: "pokemcp-team",
      partialize: (state) => ({ mode: state.mode, format: state.format, team: state.team }),
    }
  )
);
