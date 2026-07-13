"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHasSavedTeam } from "@/hooks/useHasSavedTeam";

/**
 * Client-only redirect: returning users with a persisted non-empty team skip
 * the landing and go straight to the builder. `useHasSavedTeam` waits for
 * Zustand rehydration before flipping `hasSavedTeam` to true, so cold
 * visitors never see a flash into `/build`.
 */
export function SavedTeamRedirect() {
    const router = useRouter();
    const { hasSavedTeam } = useHasSavedTeam();

    useEffect(() => {
        if (hasSavedTeam) {
            router.replace("/build");
        }
    }, [hasSavedTeam, router]);

    return null;
}
