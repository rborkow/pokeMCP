"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTeamStore } from "@/stores/team-store";
import { useHistoryStore } from "@/stores/history-store";
import { useChatStore } from "@/stores/chat-store";
import { QUICKSTART_PROMPT } from "@/types/chat";
import { Sparkles, Upload, PlusCircle } from "lucide-react";

interface WelcomeOverlayProps {
  onGenerate: () => void;
  onBuildOwn: () => void;
}

export function WelcomeOverlay({ onGenerate, onBuildOwn }: WelcomeOverlayProps) {
  const { team, importTeam } = useTeamStore();
  const { pushState } = useHistoryStore();
  const [dismissed, setDismissed] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const isOpen = team.length === 0 && !dismissed;

  const handleGenerate = () => {
    setDismissed(true);
    onGenerate();
  };

  const handleBuildOwn = () => {
    setDismissed(true);
    onBuildOwn();
  };

  const handleImport = () => {
    const result = importTeam(importText);
    if (result.success) {
      pushState(team, "Imported team", "import");
      setImportText("");
      setImportError(null);
      setShowImport(false);
      setDismissed(true);
    } else {
      setImportError(result.error || "Failed to import team");
    }
  };

  if (showImport) {
    return (
      <Dialog open={isOpen} onOpenChange={() => setShowImport(false)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Import Team</DialogTitle>
            <DialogDescription>
              Paste your Pokemon Showdown team below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={`Garchomp @ Life Orb
Ability: Rough Skin
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Swords Dance
- Fire Fang`}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError(null);
              }}
              className="min-h-[200px] font-mono text-sm"
            />
            {importError && (
              <p className="text-sm text-destructive">{importError}</p>
            )}
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setShowImport(false)}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={!importText.trim()}>
                Import Team
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-[95vw] sm:max-w-[700px] p-8"
        showCloseButton={false}
      >
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto">
            <div className="pokeball-icon mx-auto mb-4" />
          </div>
          <DialogTitle className="text-3xl font-display">
            <span className="text-gradient">Welcome to PokeMCP</span>
          </DialogTitle>
          <DialogDescription className="text-base">
            Build competitive Pokemon teams with AI-powered analysis
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {/* Generate Team Card */}
          <button
            onClick={handleGenerate}
            className="welcome-option-card welcome-option-primary group"
          >
            <div className="flex flex-col items-center gap-3 p-6">
              <div className="p-3 rounded-xl bg-primary/20 text-primary group-hover:scale-110 transition-transform">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="text-center">
                <h3 className="font-display font-bold text-lg">Generate Team</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Let AI build a competitive team for you
                </p>
              </div>
            </div>
          </button>

          {/* Import Team Card */}
          <button
            onClick={() => setShowImport(true)}
            className="welcome-option-card group"
          >
            <div className="flex flex-col items-center gap-3 p-6">
              <div className="p-3 rounded-xl bg-muted text-muted-foreground group-hover:bg-secondary/20 group-hover:text-secondary transition-colors">
                <Upload className="h-8 w-8" />
              </div>
              <div className="text-center">
                <h3 className="font-display font-bold text-lg">Import Team</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Paste a Showdown format team
                </p>
              </div>
            </div>
          </button>

          {/* Build Your Own Card */}
          <button
            onClick={handleBuildOwn}
            className="welcome-option-card group"
          >
            <div className="flex flex-col items-center gap-3 p-6">
              <div className="p-3 rounded-xl bg-muted text-muted-foreground group-hover:bg-accent/20 group-hover:text-accent transition-colors">
                <PlusCircle className="h-8 w-8" />
              </div>
              <div className="text-center">
                <h3 className="font-display font-bold text-lg">Build Your Own</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Start from scratch manually
                </p>
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
