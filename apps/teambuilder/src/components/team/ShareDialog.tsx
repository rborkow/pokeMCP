"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
    Check,
    Copy,
    Download,
    ExternalLink,
    FileJson,
    ImageIcon,
    Link,
    Loader2,
    MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createSharedTeam } from "@/lib/share-api";
import { generateShareUrl, copyToClipboard } from "@/lib/share";
import { exportShowdownTeam } from "@/lib/showdown-parser";
import {
    getTwitterShareUrl,
    getRedditShareUrl,
    formatDiscordMessage,
    downloadTeamAsJson,
} from "@/lib/social-share";
import { TeamCard } from "@/components/team/TeamCard";
import type { TeamPokemon } from "@/types/pokemon";
import { getFormatDisplayName } from "@/types/pokemon";

interface ShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    team: TeamPokemon[];
    format: string;
}

export function ShareDialog({ open, onOpenChange, team, format }: ShareDialogProps) {
    const [shortUrl, setShortUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedShowdown, setCopiedShowdown] = useState(false);
    const [copiedDiscord, setCopiedDiscord] = useState(false);
    const teamCardRef = useRef<HTMLDivElement>(null);

    // Create short URL when dialog opens
    useEffect(() => {
        if (!open || team.length === 0) return;
        // Reset state on open
        setShortUrl(null);
        setError(null);
        setLoading(true);

        createSharedTeam(team, format)
            .then((result) => {
                setShortUrl(result.url);
            })
            .catch((err) => {
                console.error("Failed to create short URL:", err);
                setError("Failed to create short link. You can still use the direct link below.");
            })
            .finally(() => setLoading(false));
    }, [open, team, format]);

    const shareUrl = shortUrl || generateShareUrl(team, format);

    const handleCopyLink = useCallback(async () => {
        const success = await copyToClipboard(shareUrl);
        if (success) {
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        }
    }, [shareUrl]);

    const handleCopyShowdown = useCallback(async () => {
        const text = exportShowdownTeam(team);
        const success = await copyToClipboard(text);
        if (success) {
            setCopiedShowdown(true);
            setTimeout(() => setCopiedShowdown(false), 2000);
        }
    }, [team]);

    const handleCopyDiscord = useCallback(async () => {
        const message = formatDiscordMessage(team, format, shareUrl);
        const success = await copyToClipboard(message);
        if (success) {
            setCopiedDiscord(true);
            setTimeout(() => setCopiedDiscord(false), 2000);
        }
    }, [team, format, shareUrl]);

    const handleDownloadJson = useCallback(() => {
        downloadTeamAsJson(team, format);
    }, [team, format]);

    const handleDownloadImage = useCallback(async () => {
        // Dynamically import html-to-image to keep bundle size down
        const { toPng } = await import("html-to-image");
        const cardEl = teamCardRef.current;
        if (!cardEl) return;

        try {
            const dataUrl = await toPng(cardEl, {
                width: 1200,
                height: 630,
                pixelRatio: 1,
            });
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `team-${format}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            console.error("Failed to generate image:", err);
        }
    }, [format]);

    const formatName = getFormatDisplayName(format);
    const showdownText = exportShowdownTeam(team);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Share Team</DialogTitle>
                    <DialogDescription>
                        Share your {formatName} team with the world.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="link" className="w-full">
                    <TabsList className="w-full">
                        <TabsTrigger value="link" className="flex-1 gap-1.5">
                            <Link className="h-3.5 w-3.5" />
                            Link
                        </TabsTrigger>
                        <TabsTrigger value="social" className="flex-1 gap-1.5">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Social
                        </TabsTrigger>
                        <TabsTrigger value="export" className="flex-1 gap-1.5">
                            <Download className="h-3.5 w-3.5" />
                            Export
                        </TabsTrigger>
                    </TabsList>

                    {/* Link Tab */}
                    <TabsContent value="link" className="space-y-4 mt-4">
                        {/* URL */}
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={loading ? "Generating short link..." : shareUrl}
                                    readOnly
                                    className="flex-1 px-3 py-2 text-sm bg-muted rounded-md font-mono truncate"
                                />
                                <Button
                                    onClick={handleCopyLink}
                                    disabled={loading}
                                    className="gap-2 shrink-0"
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : copiedLink ? (
                                        <>
                                            <Check className="h-4 w-4" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-4 w-4" />
                                            Copy
                                        </>
                                    )}
                                </Button>
                            </div>
                            {error && <p className="text-xs text-amber-500">{error}</p>}
                            {shortUrl && (
                                <p className="text-xs text-muted-foreground">
                                    Short link with rich preview on Discord, Twitter, and more.
                                </p>
                            )}
                        </div>

                        {/* QR Code */}
                        {!loading && shareUrl && (
                            <div className="flex justify-center p-4 bg-white rounded-lg">
                                <QRCodeSVG
                                    value={shareUrl}
                                    size={180}
                                    level="M"
                                    bgColor="white"
                                    fgColor="#0f172a"
                                />
                            </div>
                        )}
                    </TabsContent>

                    {/* Social Tab */}
                    <TabsContent value="social" className="space-y-3 mt-4">
                        {/* Twitter/X */}
                        <a
                            href={getTwitterShareUrl(shareUrl, format, team)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                            <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center text-background font-bold text-lg shrink-0">
                                X
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium">Share on X / Twitter</div>
                                <div className="text-xs text-muted-foreground truncate">
                                    Post your {formatName} team
                                </div>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                        </a>

                        {/* Reddit */}
                        <a
                            href={getRedditShareUrl(shareUrl, format, team)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                            <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                                R
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium">Share on Reddit</div>
                                <div className="text-xs text-muted-foreground truncate">
                                    Submit to a subreddit
                                </div>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                        </a>

                        {/* Discord (copy formatted message) */}
                        <button
                            type="button"
                            onClick={handleCopyDiscord}
                            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors w-full text-left"
                        >
                            <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white shrink-0">
                                <MessageSquare className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium">Copy for Discord</div>
                                <div className="text-xs text-muted-foreground truncate">
                                    {copiedDiscord
                                        ? "Copied! Paste in Discord."
                                        : "Formatted message with team details"}
                                </div>
                            </div>
                            {copiedDiscord ? (
                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                            ) : (
                                <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                        </button>
                    </TabsContent>

                    {/* Export Tab */}
                    <TabsContent value="export" className="space-y-4 mt-4">
                        {/* Showdown Paste */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Showdown Paste</label>
                            <Textarea
                                value={showdownText}
                                readOnly
                                className="min-h-[120px] font-mono text-xs"
                            />
                            <Button
                                onClick={handleCopyShowdown}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                            >
                                {copiedShowdown ? (
                                    <>
                                        <Check className="h-4 w-4" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4" />
                                        Copy Paste
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Download buttons */}
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                onClick={handleDownloadJson}
                                variant="outline"
                                className="gap-2 flex-1"
                            >
                                <FileJson className="h-4 w-4" />
                                Download JSON
                            </Button>
                            <Button
                                onClick={handleDownloadImage}
                                variant="outline"
                                className="gap-2 flex-1"
                            >
                                <ImageIcon className="h-4 w-4" />
                                Download Image
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Hidden team card for image export */}
                <div className="absolute -left-[9999px] -top-[9999px]">
                    <TeamCard ref={teamCardRef} team={team} format={format} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
