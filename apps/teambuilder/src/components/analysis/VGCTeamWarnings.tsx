"use client";

import { useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTeamStore } from "@/stores/team-store";
import { analyzeVGCTeam, type VGCTeamWarning } from "@/lib/vgc-analysis";
import { AlertTriangle, Info, XCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

function WarningIcon({ level }: { level: VGCTeamWarning["level"] }) {
  switch (level) {
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "info":
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function WarningItem({ warning }: { warning: VGCTeamWarning }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 p-2 rounded-md text-sm",
        warning.level === "error" && "bg-destructive/10",
        warning.level === "warning" && "bg-yellow-500/10",
        warning.level === "info" && "bg-blue-500/10"
      )}
    >
      <WarningIcon level={warning.level} />
      <div className="flex-1">
        <p className="font-medium">{warning.message}</p>
        {warning.suggestion && (
          <p className="text-xs text-muted-foreground mt-0.5">{warning.suggestion}</p>
        )}
      </div>
    </div>
  );
}

export function VGCTeamWarnings() {
  const { team, mode } = useTeamStore();

  const warnings = useMemo(() => {
    if (mode !== "vgc" || team.length === 0) return [];
    return analyzeVGCTeam(team);
  }, [team, mode]);

  // Don't show anything in singles mode or with empty team
  if (mode !== "vgc" || team.length === 0) {
    return null;
  }

  // No warnings - show success state
  if (warnings.length === 0) {
    return (
      <Alert className="border-green-500/50 bg-green-500/5">
        <Shield className="h-4 w-4 text-green-500" />
        <AlertTitle className="text-green-700 dark:text-green-400">VGC Ready</AlertTitle>
        <AlertDescription className="text-green-600/80 dark:text-green-400/80">
          No common VGC team building issues detected.
        </AlertDescription>
      </Alert>
    );
  }

  const errorCount = warnings.filter((w) => w.level === "error").length;
  const warningCount = warnings.filter((w) => w.level === "warning").length;

  return (
    <Alert className="border-yellow-500/50 bg-yellow-500/5">
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <AlertTitle className="text-yellow-700 dark:text-yellow-400">
        VGC Team Analysis
        {errorCount > 0 && ` • ${errorCount} issue${errorCount > 1 ? "s" : ""}`}
        {warningCount > 0 && ` • ${warningCount} warning${warningCount > 1 ? "s" : ""}`}
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-2">
          {warnings.map((warning, i) => (
            <WarningItem key={i} warning={warning} />
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
