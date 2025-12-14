"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTeamStore } from "@/stores/team-store";

/**
 * Hook to load team from URL parameter on initial page load
 * Only loads once - doesn't sync changes back to URL
 */
export function useUrlTeam() {
  const searchParams = useSearchParams();
  const loadFromUrlParam = useTeamStore((state) => state.loadFromUrlParam);
  const hasLoaded = useRef(false);

  useEffect(() => {
    // Only run once on mount
    if (hasLoaded.current) return;

    const teamParam = searchParams.get("team");
    if (teamParam) {
      const success = loadFromUrlParam(teamParam);
      if (success) {
        // Clear the URL param after loading (optional - keeps URL clean)
        // We don't do this to allow refresh to reload the same team
        console.log("[useUrlTeam] Successfully loaded team from URL");
      } else {
        console.warn("[useUrlTeam] Failed to decode team from URL parameter");
      }
    }

    hasLoaded.current = true;
  }, [searchParams, loadFromUrlParam]);
}
