"use client";

import { useSyncExternalStore } from "react";
import { useTeamStore } from "@/stores/team-store";

/**
 * Hydration-safe read of the persisted team. During SSR and before Zustand's
 * `persist` middleware finishes rehydrating from localStorage, `hydrated` is
 * false and `hasSavedTeam` is always false — this prevents a flash where the
 * landing page briefly renders for returning users before redirecting them.
 *
 * Uses useSyncExternalStore so the hydration signal is read without
 * synchronous setState-in-effect patterns.
 */

function subscribeToHydration(onChange: () => void): () => void {
    const persist = useTeamStore.persist;
    // `persist` is attached on the client by the middleware; guard for SSR safety.
    if (!persist) return () => {};
    return persist.onFinishHydration(onChange);
}

function getHydrationStatus(): boolean {
    return useTeamStore.persist?.hasHydrated() ?? false;
}

function getServerHydrationStatus(): boolean {
    return false;
}

export function useHasSavedTeam(): { hydrated: boolean; hasSavedTeam: boolean } {
    const hydrated = useSyncExternalStore(
        subscribeToHydration,
        getHydrationStatus,
        getServerHydrationStatus,
    );
    const teamLength = useTeamStore((s) => s.team.length);

    return {
        hydrated,
        hasSavedTeam: hydrated && teamLength > 0,
    };
}
