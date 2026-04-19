import { create } from "zustand";
import { persist } from "zustand/middleware";
import { decodeTeamFromUrl } from "@/lib/share";
import { exportShowdownTeam, parseShowdownTeam } from "@/lib/showdown-parser";
import type { FormatId, Mode, TeamPokemon } from "@/types/pokemon";
import { isFormatValidForMode, MODE_INFO } from "@/types/pokemon";

export type UiMode = "chat" | "grid";
export type ModificationSource = "user" | "ai" | "import";

interface TeamState {
    mode: Mode;
    format: FormatId;
    team: TeamPokemon[];
    selectedSlot: number | null;
    uiMode: UiMode;
    /** Ephemeral — slot → timestamp of the most recent write. Not persisted. */
    lastModifiedAt: Record<number, number>;
    /** Ephemeral — slot → whether the last write came from the user, the AI, or an import. Not persisted. */
    lastModificationSource: Record<number, ModificationSource>;

    // Actions
    setMode: (mode: Mode) => void;
    setFormat: (format: FormatId) => void;
    setPokemon: (slot: number, pokemon: TeamPokemon, source?: ModificationSource) => void;
    removePokemon: (slot: number, source?: ModificationSource) => void;
    swapSlots: (from: number, to: number, source?: ModificationSource) => void;
    importTeam: (
        showdownText: string,
        source?: ModificationSource,
    ) => { success: boolean; error?: string };
    exportTeam: () => string;
    clearTeam: () => void;
    setSelectedSlot: (slot: number | null) => void;
    setUiMode: (mode: UiMode) => void;
    loadFromUrlParam: (encoded: string) => boolean;
}

export const useTeamStore = create<TeamState>()(
    persist(
        (set, get) => ({
            mode: "singles",
            format: "gen9ou",
            team: [],
            selectedSlot: null,
            uiMode: "chat",
            lastModifiedAt: {},
            lastModificationSource: {},

            setUiMode: (uiMode) => set({ uiMode }),

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

            setPokemon: (slot, pokemon, source = "user") => {
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
                    const now = Date.now();
                    return {
                        team: newTeam.filter(Boolean),
                        lastModifiedAt: { ...state.lastModifiedAt, [slot]: now },
                        lastModificationSource: {
                            ...state.lastModificationSource,
                            [slot]: source,
                        },
                    };
                });
            },

            removePokemon: (slot, source = "user") => {
                set((state) => {
                    const newTeam = state.team.filter((_, i) => i !== slot);
                    const now = Date.now();
                    return {
                        team: newTeam,
                        selectedSlot: null,
                        lastModifiedAt: { ...state.lastModifiedAt, [slot]: now },
                        lastModificationSource: {
                            ...state.lastModificationSource,
                            [slot]: source,
                        },
                    };
                });
            },

            swapSlots: (from, to, source = "user") => {
                set((state) => {
                    const newTeam = [...state.team];
                    [newTeam[from], newTeam[to]] = [newTeam[to], newTeam[from]];
                    const now = Date.now();
                    return {
                        team: newTeam,
                        lastModifiedAt: {
                            ...state.lastModifiedAt,
                            [from]: now,
                            [to]: now,
                        },
                        lastModificationSource: {
                            ...state.lastModificationSource,
                            [from]: source,
                            [to]: source,
                        },
                    };
                });
            },

            importTeam: (showdownText, source = "import") => {
                try {
                    const team = parseShowdownTeam(showdownText);
                    if (team.length === 0) {
                        return {
                            success: false,
                            error: "Could not parse any Pokemon from the input",
                        };
                    }
                    if (team.length > 6) {
                        return {
                            success: false,
                            error: "Team cannot have more than 6 Pokemon",
                        };
                    }
                    const now = Date.now();
                    const lastModifiedAt: Record<number, number> = {};
                    const lastModificationSource: Record<number, ModificationSource> = {};
                    for (let i = 0; i < team.length; i++) {
                        lastModifiedAt[i] = now;
                        lastModificationSource[i] = source;
                    }
                    set({ team, lastModifiedAt, lastModificationSource });
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

            clearTeam: () =>
                set({
                    team: [],
                    selectedSlot: null,
                    lastModifiedAt: {},
                    lastModificationSource: {},
                }),

            setSelectedSlot: (slot) => set({ selectedSlot: slot }),

            loadFromUrlParam: (encoded) => {
                const result = decodeTeamFromUrl(encoded);
                if (result && result.team.length > 0) {
                    const format = result.format as FormatId;
                    // Detect mode from format
                    const mode: Mode = isFormatValidForMode(format, "vgc") ? "vgc" : "singles";
                    const now = Date.now();
                    const lastModifiedAt: Record<number, number> = {};
                    const lastModificationSource: Record<number, ModificationSource> = {};
                    for (let i = 0; i < result.team.length; i++) {
                        lastModifiedAt[i] = now;
                        lastModificationSource[i] = "import";
                    }
                    set({
                        team: result.team,
                        format,
                        mode,
                        selectedSlot: null,
                        lastModifiedAt,
                        lastModificationSource,
                    });
                    return true;
                }
                return false;
            },
        }),
        {
            name: "pokemcp-team",
            partialize: (state) => ({
                mode: state.mode,
                format: state.format,
                team: state.team,
                uiMode: state.uiMode,
            }),
        },
    ),
);
