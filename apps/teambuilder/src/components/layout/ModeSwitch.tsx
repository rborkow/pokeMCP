"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTeamStore } from "@/stores/team-store";

const MODES = [
    { id: "chat", label: "Chat" },
    { id: "grid", label: "Grid" },
] as const;

/**
 * Chat/Grid toggle. Writes to the team-store and reflects the choice into the
 * URL as `?mode=chat|grid` so the preference is shareable and survives a
 * reload. Only renders on /build.
 */
export function ModeSwitch() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const uiMode = useTeamStore((s) => s.uiMode);
    const setUiMode = useTeamStore((s) => s.setUiMode);

    const onSelect = useCallback(
        (mode: "chat" | "grid") => {
            setUiMode(mode);
            const params = new URLSearchParams(searchParams?.toString() ?? "");
            if (mode === "chat") {
                params.delete("mode");
            } else {
                params.set("mode", mode);
            }
            const query = params.toString();
            router.replace(`${pathname}${query ? `?${query}` : ""}`);
        },
        [pathname, router, searchParams, setUiMode],
    );

    if (!pathname?.startsWith("/build")) return null;

    return (
        <div
            role="tablist"
            aria-label="Builder layout"
            className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 p-0.5 text-[11px]"
        >
            {MODES.map((mode) => {
                const isActive = uiMode === mode.id;
                return (
                    <button
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        key={mode.id}
                        onClick={() => onSelect(mode.id)}
                        className={cn(
                            "px-2.5 py-1 rounded-sm font-medium transition-colors",
                            isActive
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {mode.label}
                    </button>
                );
            })}
        </div>
    );
}
