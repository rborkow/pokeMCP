"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTeamStore } from "@/stores/team-store";
import { useHistoryStore } from "@/stores/history-store";
import { Upload, Download, Copy, Check, Share2, Link } from "lucide-react";
import { generateShareUrl, copyToClipboard } from "@/lib/share";

export function TeamImportExport() {
  const { team, format, importTeam, exportTeam, clearTeam } = useTeamStore();
  const { pushState } = useHistoryStore();
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const handleImport = () => {
    const result = importTeam(importText);
    if (result.success) {
      pushState(team, "Imported team", "import");
      setImportText("");
      setImportError(null);
      setImportOpen(false);
    } else {
      setImportError(result.error || "Failed to import team");
    }
  };

  const handleCopy = async () => {
    const text = exportTeam();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportText = exportTeam();

  return (
    <div className="flex gap-2">
      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Team</DialogTitle>
            <DialogDescription>
              Paste your Pokemon Showdown team in the text area below.
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
- Fire Fang

Landorus-Therian @ Choice Scarf
...`}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError(null);
              }}
              className="min-h-[150px] sm:min-h-[200px] font-mono text-sm"
            />
            {importError && (
              <p className="text-sm text-destructive">{importError}</p>
            )}
            <div className="flex flex-col-reverse sm:flex-row justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  clearTeam();
                  setImportOpen(false);
                }}
              >
                Clear Team
              </Button>
              <Button onClick={handleImport} disabled={!importText.trim()}>
                Import Team
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={team.length === 0}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Export Team</DialogTitle>
            <DialogDescription>
              Copy your team in Pokemon Showdown format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={exportText}
              readOnly
              className="min-h-[150px] sm:min-h-[200px] font-mono text-sm"
            />
            <div className="flex justify-end">
              <Button onClick={handleCopy} className="gap-2">
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={team.length === 0}
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Share Team</DialogTitle>
            <DialogDescription>
              Copy this link to share your {format.toUpperCase()} team with others.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={generateShareUrl(team, format)}
                readOnly
                className="flex-1 px-3 py-2 text-sm bg-muted rounded-md font-mono truncate"
              />
              <Button
                onClick={async () => {
                  const success = await copyToClipboard(generateShareUrl(team, format));
                  if (success) {
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  }
                }}
                className="gap-2"
              >
                {shareCopied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This link includes your full team configuration and format.
              Anyone with this link can view and import your team.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
