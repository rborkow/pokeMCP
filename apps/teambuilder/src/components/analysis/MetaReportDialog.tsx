"use client";

import { TrendingUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    StreamingMarkdown,
    type StreamingMarkdownHandle,
} from "@/components/chat/StreamingMarkdown";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import type { Mode } from "@/types/pokemon";

type Status = "idle" | "loading" | "streaming" | "done" | "error";

const WINDOW_MONTHS = 6;

/**
 * Format-level "meta report" trigger. Streams the AI metagame-evolution narrative
 * from /api/ai/meta-report/stream (Opus 4.8, grounded in get_meta_trends data) into
 * a dialog. The report depends only on the current format, not the team — so it
 * works from an empty team too. The generated markdown is cached per open/close so
 * reopening doesn't re-bill a model call; "Regenerate" forces a fresh pass.
 */
export function MetaReportDialog({ format, mode }: { format: string; mode: Mode }) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);
    const mdRef = useRef<StreamingMarkdownHandle>(null);
    const abortRef = useRef<AbortController | null>(null);
    const cacheRef = useRef<{ key: string; text: string } | null>(null);

    const cacheKey = `${format}|${mode}`;

    const run = useCallback(async () => {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setError(null);
        setStatus("loading");
        mdRef.current?.setContent("");

        try {
            const res = await fetch("/api/ai/meta-report/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format, mode, window: WINDOW_MONTHS }),
                signal: ctrl.signal,
            });

            if (!res.ok || !res.body) {
                const raw = await res.text().catch(() => "");
                let msg = `Request failed (${res.status})`;
                try {
                    msg = (JSON.parse(raw) as { error?: string }).error ?? msg;
                } catch {
                    /* non-JSON error body */
                }
                setError(msg);
                setStatus("error");
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let sawText = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split("\n\n");
                buffer = events.pop() ?? "";
                for (const event of events) {
                    for (const line of event.split("\n")) {
                        if (!line.startsWith("data: ")) continue;
                        const data = line.slice(6);
                        if (!data) continue;
                        let parsed: { type?: string; delta?: string; error?: { message?: string } };
                        try {
                            parsed = JSON.parse(data);
                        } catch {
                            continue;
                        }
                        if (
                            parsed.type === "TEXT_MESSAGE_CONTENT" &&
                            typeof parsed.delta === "string"
                        ) {
                            if (!sawText) {
                                sawText = true;
                                setStatus("streaming");
                            }
                            mdRef.current?.pushDelta(parsed.delta);
                        } else if (parsed.type === "RUN_ERROR") {
                            setError(parsed.error?.message ?? "Stream error");
                            setStatus("error");
                            return;
                        }
                    }
                }
            }

            cacheRef.current = { key: cacheKey, text: mdRef.current?.getContent() ?? "" };
            setStatus(sawText ? "done" : "error");
            if (!sawText) setError("No report was generated.");
        } catch (e) {
            if (e instanceof Error && e.name === "AbortError") return;
            setError(e instanceof Error ? e.message : "Failed to generate report");
            setStatus("error");
        }
    }, [format, mode, cacheKey]);

    // On open: restore the cached report for this format/mode, or generate fresh.
    useEffect(() => {
        if (!open) return;
        const cached = cacheRef.current;
        if (cached && cached.key === cacheKey && cached.text) {
            mdRef.current?.setContent(cached.text);
            setStatus("done");
            return;
        }
        void run();
    }, [open, cacheKey, run]);

    const onOpenChange = useCallback((next: boolean) => {
        setOpen(next);
        if (!next) abortRef.current?.abort();
    }, []);

    const regenerate = useCallback(() => {
        cacheRef.current = null;
        void run();
    }, [run]);

    const busy = status === "loading" || status === "streaming";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                    <TrendingUp className="size-3.5" />
                    Meta report
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Metagame report — {format.toUpperCase()}</DialogTitle>
                    <DialogDescription>
                        How {format.toUpperCase()} has shifted over the last {WINDOW_MONTHS} months
                        — AI analysis grounded in Smogon usage trends.
                    </DialogDescription>
                </DialogHeader>

                <div
                    data-chat-scroll
                    className="max-h-[60vh] min-h-[6rem] overflow-y-auto pr-1 text-sm leading-relaxed"
                >
                    {status === "loading" && (
                        <p className="signal-mono text-muted-foreground">
                            Pulling usage trends and analyzing…
                        </p>
                    )}
                    {status === "error" && (
                        <p className="text-sm text-red-500">{error ?? "Something went wrong."}</p>
                    )}
                    <StreamingMarkdown ref={mdRef} />
                </div>

                <DialogFooter className="items-center">
                    <span className="signal-mono mr-auto text-muted-foreground">
                        {status === "streaming"
                            ? "Writing…"
                            : status === "done"
                              ? "Generated by Opus 4.8"
                              : ""}
                    </span>
                    <Button variant="outline" size="sm" onClick={regenerate} disabled={busy}>
                        Regenerate
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
