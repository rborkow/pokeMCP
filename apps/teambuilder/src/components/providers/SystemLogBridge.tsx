"use client";

import { useEffect } from "react";
import { toDisplayName } from "@/lib/showdown-parser";
import { useChatStore } from "@/stores/chat-store";
import { useTeamStore } from "@/stores/team-store";
import type { TeamPokemon } from "@/types/pokemon";

interface Snapshot {
    team: TeamPokemon[];
    lastModifiedAt: Record<number, number>;
}

function evsEqual(a?: TeamPokemon["evs"], b?: TeamPokemon["evs"]): boolean {
    if (a === b) return true;
    if (!a || !b) return !a && !b;
    const keys: Array<keyof NonNullable<TeamPokemon["evs"]>> = [
        "hp",
        "atk",
        "def",
        "spa",
        "spd",
        "spe",
    ];
    return keys.every((k) => (a[k] ?? 0) === (b[k] ?? 0));
}

function movesEqual(a?: string[], b?: string[]): boolean {
    if (a === b) return true;
    if (!a || !b) return (a?.length ?? 0) === (b?.length ?? 0);
    if (a.length !== b.length) return false;
    return a.every((m, i) => m === b[i]);
}

function describeEdit(
    slot: number,
    prev: TeamPokemon | undefined,
    curr: TeamPokemon | undefined,
): string | null {
    if (!prev && !curr) return null;
    if (!prev && curr) {
        return `Added ${toDisplayName(curr.pokemon)} in slot ${slot + 1}.`;
    }
    if (prev && !curr) {
        return `Removed ${toDisplayName(prev.pokemon)} from slot ${slot + 1}.`;
    }
    if (!prev || !curr) return null;

    const name = toDisplayName(curr.pokemon);
    if (prev.pokemon !== curr.pokemon) {
        return `Replaced slot ${slot + 1} with ${name}.`;
    }
    if ((prev.item ?? "") !== (curr.item ?? "")) {
        return curr.item ? `Changed ${name}'s item to ${curr.item}.` : `Cleared ${name}'s item.`;
    }
    if ((prev.ability ?? "") !== (curr.ability ?? "")) {
        return `Changed ${name}'s ability to ${curr.ability ?? "—"}.`;
    }
    if ((prev.teraType ?? "") !== (curr.teraType ?? "")) {
        return `Set ${name}'s Tera to ${curr.teraType ?? "—"}.`;
    }
    if ((prev.nature ?? "") !== (curr.nature ?? "")) {
        return `Changed ${name}'s nature to ${curr.nature ?? "—"}.`;
    }
    if (!movesEqual(prev.moves, curr.moves)) {
        return `Updated ${name}'s moves.`;
    }
    if (!evsEqual(prev.evs, curr.evs)) {
        return `Retuned ${name}'s spread.`;
    }
    return null;
}

/**
 * Watches the team store and pushes a short chat entry whenever a *user*
 * edit lands in a slot. AI-driven and import-driven mutations are ignored —
 * the NEW-slot flash covers AI; import is its own chrome.
 */
export function SystemLogBridge() {
    useEffect(() => {
        let prev: Snapshot = {
            team: useTeamStore.getState().team.slice(),
            lastModifiedAt: { ...useTeamStore.getState().lastModifiedAt },
        };

        const unsubscribe = useTeamStore.subscribe((state) => {
            const touched: number[] = [];
            for (const key of Object.keys(state.lastModifiedAt)) {
                const slot = Number(key);
                const curr = state.lastModifiedAt[slot];
                const was = prev.lastModifiedAt[slot] ?? 0;
                if (curr > was && state.lastModificationSource[slot] === "user") {
                    touched.push(slot);
                }
            }

            for (const slot of touched) {
                const text = describeEdit(slot, prev.team[slot], state.team[slot]);
                if (!text) continue;
                useChatStore.getState().appendSystemLog({
                    text,
                    slot,
                    kind: "user_edit",
                });
            }

            prev = {
                team: state.team.slice(),
                lastModifiedAt: { ...state.lastModifiedAt },
            };
        });

        return () => unsubscribe();
    }, []);

    return null;
}
