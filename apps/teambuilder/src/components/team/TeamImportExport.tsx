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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTeamStore } from "@/stores/team-store";
import { useChatStore } from "@/stores/chat-store";
import { useHistoryStore } from "@/stores/history-store";
import { Upload, Download, Copy, Check, Share2, RotateCcw } from "lucide-react";
import { ShareDialog } from "@/components/team/ShareDialog";

export function TeamImportExport() {
    const { team, format, importTeam, exportTeam, clearTeam } = useTeamStore();
    const { clearChat } = useChatStore();
    const { pushState, clearHistory } = useHistoryStore();
    const [importText, setImportText] = useState("");
    const [importError, setImportError] = useState<string | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleReset = () => {
        clearTeam();
        clearChat();
        clearHistory();
    };

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
                        <span className="hidden sm:inline">Import</span>
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
                        {importError && <p className="text-sm text-destructive">{importError}</p>}
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
                        <span className="hidden sm:inline">Export</span>
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
            <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={team.length === 0}
                onClick={() => setShareOpen(true)}
            >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
            </Button>
            <ShareDialog open={shareOpen} onOpenChange={setShareOpen} team={team} format={format} />

            {/* Reset Confirmation */}
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                        <RotateCcw className="h-4 w-4" />
                        <span className="hidden sm:inline">Reset</span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[95vw] sm:max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Everything?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will clear your current team, chat history, and team history. This
                            action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleReset}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Reset
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
