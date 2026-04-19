"use client";

import { useEffect, useState } from "react";
import { useTeamStore } from "@/stores/team-store";

/**
 * Hydration-safe read of the persisted team. During SSR and before Zustand's
 * `persist` middleware finishes rehydrating from localStorage, `hydrated` is
 * false and `hasSavedTeam` is always false — this prevents a flash where the
 * landing page briefly renders for returning users before redirecting them.
 */
export function useHasSavedTeam(): { hydrated: boolean; hasSavedTeam: boolean } {
    const [hydrated, setHydrated] = useState(false);
    const teamLength = useTeamStore((s) => s.team.length);

    useEffect(() => {
        // `persist` is attached on the client by the middleware; guard for SSR safety.
        const persist = useTeamStore.persist;
        if (!persist) return;

        if (persist.hasHydrated()) {
            setHydrated(true);
            return;
        }

        const unsubscribe = persist.onFinishHydration(() => {
            setHydrated(true);
        });

        return unsubscribe;
    }, []);

    return {
        hydrated,
        hasSavedTeam: hydrated && teamLength > 0,
    };
}
