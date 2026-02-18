import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TeamPokemon } from "@/types/pokemon";

export interface TeamDiff {
    added: TeamPokemon[];
    removed: TeamPokemon[];
    modified: {
        before: TeamPokemon;
        after: TeamPokemon;
        changes: string[];
    }[];
}

export interface HistoryEntry {
    id: string;
    timestamp: Date;
    team: TeamPokemon[];
    reason: string;
    source: "user" | "ai" | "import";
}

interface HistoryState {
    entries: HistoryEntry[];
    maxEntries: number;

    // Actions
    pushState: (team: TeamPokemon[], reason: string, source?: "user" | "ai" | "import") => void;
    clearHistory: () => void;
    getEntry: (id: string) => HistoryEntry | undefined;
    calculateDiff: (before: TeamPokemon[], after: TeamPokemon[]) => TeamDiff;
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((item, i) => item === b[i]);
}

function findChanges(before: TeamPokemon, after: TeamPokemon): string[] {
    const changes: string[] = [];
    if (before.item !== after.item) changes.push("item");
    if (before.ability !== after.ability) changes.push("ability");
    if (!arraysEqual(before.moves || [], after.moves || [])) changes.push("moves");
    if (JSON.stringify(before.evs) !== JSON.stringify(after.evs)) changes.push("evs");
    if (before.nature !== after.nature) changes.push("nature");
    if (before.teraType !== after.teraType) changes.push("teraType");
    return changes;
}

export const useHistoryStore = create<HistoryState>()(
    persist(
        (set, get) => ({
            entries: [],
            maxEntries: 50,

            pushState: (team, reason, source = "user") => {
                const entry: HistoryEntry = {
                    id: crypto.randomUUID(),
                    timestamp: new Date(),
                    team: JSON.parse(JSON.stringify(team)), // Deep clone
                    reason,
                    source,
                };

                set((state) => {
                    const newEntries = [entry, ...state.entries].slice(0, state.maxEntries);
                    return { entries: newEntries };
                });
            },

            clearHistory: () => set({ entries: [] }),

            getEntry: (id) => {
                return get().entries.find((e) => e.id === id);
            },

            calculateDiff: (before, after) => {
                const beforeMap = new Map(before.map((p) => [p.pokemon, p]));
                const afterMap = new Map(after.map((p) => [p.pokemon, p]));

                const added = after.filter((p) => !beforeMap.has(p.pokemon));
                const removed = before.filter((p) => !afterMap.has(p.pokemon));
                const modified: TeamDiff["modified"] = [];

                for (const [species, afterPokemon] of afterMap) {
                    const beforePokemon = beforeMap.get(species);
                    if (beforePokemon) {
                        const changes = findChanges(beforePokemon, afterPokemon);
                        if (changes.length > 0) {
                            modified.push({
                                before: beforePokemon,
                                after: afterPokemon,
                                changes,
                            });
                        }
                    }
                }

                return { added, removed, modified };
            },
        }),
        {
            name: "pokemcp-history",
            partialize: (state) => ({ entries: state.entries.slice(0, 20) }), // Only persist last 20
        },
    ),
);
