"use client";

import { useEffect } from "react";
import { createTeamSnapshot } from "@/lib/prep/schema";
import { DEFAULT_CHAMPIONS_FORMAT } from "@/lib/prep/capabilities";
import { usePrepStore } from "@/stores/prep-store";
import { useTeamStore } from "@/stores/team-store";

export function WorkspaceMigrationBridge() {
    const team = useTeamStore((state) => state.team);
    const format = useTeamStore((state) => state.format);

    useEffect(() => {
        const migrate = () => {
            const prep = usePrepStore.getState();
            if (prep.legacyMigrationComplete) return;
            if (team.length > 0) {
                try {
                    prep.saveTeam(
                        createTeamSnapshot(
                            "My migrated team",
                            format.startsWith("champions-") ? format : DEFAULT_CHAMPIONS_FORMAT,
                            team,
                            { id: "current-workspace-team" },
                        ),
                    );
                } catch {
                    // The old localStorage value remains untouched so the user can export it.
                }
            }
            prep.markLegacyMigrationComplete();
        };

        if (usePrepStore.persist.hasHydrated()) migrate();
        return usePrepStore.persist.onFinishHydration(migrate);
    }, [format, team]);

    return null;
}
