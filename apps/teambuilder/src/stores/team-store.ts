import { create } from "zustand";
import { DEFAULT_CHAMPIONS_FORMAT } from "@/lib/prep/capabilities";
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
    /** Ephemeral logical slot map. Keeps out-of-order AI writes from compacting into the wrong slot. */
    slotAssignments: Record<number, TeamPokemon>;

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
            mode: "vgc",
            format: DEFAULT_CHAMPIONS_FORMAT,
            team: [],
            selectedSlot: null,
            uiMode: "chat",
            lastModifiedAt: {},
            lastModificationSource: {},
            slotAssignments: {},

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
                    const existingAssignments =
                        Object.keys(state.slotAssignments).length > 0
                            ? state.slotAssignments
                            : Object.fromEntries(state.team.map((entry, index) => [index, entry]));
                    const existingKeys = Object.keys(existingAssignments)
                        .map(Number)
                        .sort((a, b) => a - b);
                    const logicalSlot =
                        source === "ai" ? slot : (existingKeys[slot] ?? slot);
                    const slotAssignments = {
                        ...existingAssignments,
                        [logicalSlot]: pokemon,
                    };
                    const newTeam = Object.entries(slotAssignments)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([, entry]) => entry);
                    const now = Date.now();
                    return {
                        team: newTeam,
                        slotAssignments,
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
                    const existingAssignments =
                        Object.keys(state.slotAssignments).length > 0
                            ? { ...state.slotAssignments }
                            : Object.fromEntries(state.team.map((entry, index) => [index, entry]));
                    const logicalSlot =
                        Object.keys(existingAssignments)
                            .map(Number)
                            .sort((a, b) => a - b)[slot] ?? slot;
                    delete existingAssignments[logicalSlot];
                    const newTeam = Object.values(existingAssignments);
                    const slotAssignments = Object.fromEntries(
                        newTeam.map((entry, index) => [index, entry]),
                    );
                    const now = Date.now();
                    return {
                        team: newTeam,
                        slotAssignments,
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
                        slotAssignments: Object.fromEntries(
                            newTeam.map((entry, index) => [index, entry]),
                        ),
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
                    set({
                        team,
                        slotAssignments: Object.fromEntries(
                            team.map((entry, index) => [index, entry]),
                        ),
                        lastModifiedAt,
                        lastModificationSource,
                    });
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
                    slotAssignments: {},
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
                        slotAssignments: Object.fromEntries(
                            result.team.map((entry, index) => [index, entry]),
                        ),
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
