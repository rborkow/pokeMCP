"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useInterviewStore } from "@/stores/interview-store";
import { useTeamStore } from "@/stores/team-store";
import { ChatFirstFrame } from "./ChatFirstFrame";
import { GridFrame } from "./GridFrame";

/**
 * Frame switcher for /build. On mount, syncs the `?mode=` URL param into
 * team-store.uiMode so shareable links pick the right frame; otherwise the
 * persisted uiMode (defaults to "chat") wins. Also honors the landing-page
 * `?start=interview|import|empty` hint — routing users into the interview,
 * the import dialog, or the empty chat canvas respectively.
 */
export function BuilderLayout() {
    const searchParams = useSearchParams();
    const uiMode = useTeamStore((s) => s.uiMode);
    const setUiMode = useTeamStore((s) => s.setUiMode);
    const skipInterview = useInterviewStore((s) => s.skip);
    const startInterview = useInterviewStore((s) => s.start);

    // Derive the import hint straight from the URL param — no local state is
    // needed because the value is only consumed by TeamImportExport's
    // initial state on mount.
    const importIntent = searchParams?.get("start") === "import";

    useEffect(() => {
        const mode = searchParams?.get("mode");
        if (mode === "grid" || mode === "chat") {
            setUiMode(mode);
        }
        const start = searchParams?.get("start");
        if (start === "empty" || start === "import") {
            skipInterview();
        } else if (start === "interview") {
            // Peek at current status without listing it as a dep — we only want
            // to start the interview once in response to this URL hint.
            if (useInterviewStore.getState().status === "idle") {
                startInterview();
            }
        }
    }, [searchParams, setUiMode, skipInterview, startInterview]);

    return uiMode === "grid" ? (
        <GridFrame defaultImportOpen={importIntent} />
    ) : (
        <ChatFirstFrame defaultImportOpen={importIntent} />
    );
}
