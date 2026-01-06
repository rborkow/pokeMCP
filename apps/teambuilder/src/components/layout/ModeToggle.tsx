"use client";

import { useState } from "react";
import { Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamStore } from "@/stores/team-store";
import type { Mode } from "@/types/pokemon";
import { MODE_INFO } from "@/types/pokemon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MODE_ICONS: Record<Mode, typeof Swords> = {
  singles: Swords,
  vgc: Trophy,
};

export function ModeToggle() {
  const { mode, setMode, team } = useTeamStore();
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);

  const handleModeChange = (newMode: Mode) => {
    if (newMode === mode) return;

    // If team has Pokemon, show confirmation
    if (team.length > 0) {
      setPendingMode(newMode);
    } else {
      setMode(newMode);
    }
  };

  const confirmModeChange = () => {
    if (pendingMode) {
      setMode(pendingMode);
      setPendingMode(null);
    }
  };

  return (
    <>
      <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
        {(["singles", "vgc"] as Mode[]).map((m) => {
          const Icon = MODE_ICONS[m];
          const info = MODE_INFO[m];
          const isActive = mode === m;

          return (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{info.label}</span>
            </button>
          );
        })}
      </div>

      <AlertDialog
        open={pendingMode !== null}
        onOpenChange={(open) => !open && setPendingMode(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {pendingMode ? MODE_INFO[pendingMode].label : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {team.length} Pokémon in your team. Switching modes will change the
              available formats and may affect team legality.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmModeChange}>Switch mode</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
