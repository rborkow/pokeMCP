"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ModifyTeamInput } from "@/lib/ai/tools";
import { toDisplayName } from "@/lib/showdown-parser";
import type { SynthesisMeta } from "@/stores/interview-store";

const SLOT_KEYS = [
    "preview-slot-0",
    "preview-slot-1",
    "preview-slot-2",
    "preview-slot-3",
    "preview-slot-4",
    "preview-slot-5",
] as const;

export interface SynthesisPreviewProps {
    isStreaming: boolean;
    introText: string;
    proposed: ModifyTeamInput[];
    meta: SynthesisMeta | null;
    onApply: () => void;
    onDiscard: () => void;
}

/**
 * Read-only preview of the synthesized team. The proposed `modify_team`
 * inputs are staged here; Apply commits them through the existing action
 * pipeline, Discard resets the interview to step 1.
 */
export function SynthesisPreview({
    isStreaming,
    introText,
    proposed,
    meta,
    onApply,
    onDiscard,
}: SynthesisPreviewProps) {
    const canApply = !isStreaming && proposed.length === 6;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="signal-mono">Synthesis · {proposed.length}/6 slots</div>
                {isStreaming && (
                    <div className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Building team…
                    </div>
                )}
            </div>

            {introText && (
                <p className="text-[13px] leading-relaxed text-muted-foreground">{introText}</p>
            )}

            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SLOT_KEYS.map((key, slot) => {
                    const entry = proposed[slot];
                    return (
                        <li key={key} className="chat-first-panel rounded-md p-3">
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Slot {slot + 1}
                                </span>
                                {!entry && isStreaming && (
                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                )}
                            </div>
                            {entry ? (
                                <>
                                    <div className="mt-1 text-[14px] font-medium text-foreground">
                                        {entry.pokemon ? toDisplayName(entry.pokemon) : "—"}
                                    </div>
                                    <div className="text-[12px] text-muted-foreground truncate">
                                        {entry.item ?? entry.ability ?? entry.nature ?? ""}
                                    </div>
                                    {entry.reason && (
                                        <div className="mt-1 text-[11px] text-muted-foreground/80 line-clamp-2">
                                            {entry.reason}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="mt-1 text-[12px] text-muted-foreground/70">
                                    Pending…
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            {meta && (
                <div className="chat-first-inset rounded-md p-3 text-[12px] space-y-2">
                    <div>
                        <span className="signal-mono">Rationale</span>
                        <p className="mt-1 text-foreground">{meta.rationale}</p>
                    </div>
                    {meta.considered.length > 0 && (
                        <div>
                            <span className="signal-mono">Considered</span>
                            <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                                {meta.considered.map((item) => (
                                    <li key={`c-${item}`}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {meta.skipped.length > 0 && (
                        <div>
                            <span className="signal-mono">Skipped</span>
                            <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                                {meta.skipped.map((item) => (
                                    <li key={`s-${item}`}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={onDiscard} disabled={isStreaming}>
                    Discard
                </Button>
                <Button type="button" onClick={onApply} disabled={!canApply}>
                    Apply team
                </Button>
            </div>
        </div>
    );
}
