"use client";

import { useState } from "react";
import { FormatSelector } from "@/components/layout/FormatSelector";
import { Button } from "@/components/ui/button";
import type { InterviewStepDefinition } from "@/lib/ai/interview-prompts";
import { cn } from "@/lib/utils";

export interface InterviewStepProps {
    step: InterviewStepDefinition;
    /** Current free-text value; preserved when the user toggles choice vs text. */
    initialValue?: string;
    /** The user's choice value if they picked a choice chip. */
    initialChoice?: string;
    onSubmit: (answer: string) => void;
    onSkip?: () => void;
}

/**
 * Renders a single interview step. Layout: question + helper text, optional
 * choice chips, free-text input, submit button. The format step swaps in the
 * existing FormatSelector instead of free-text.
 *
 * Local state (choice/text) is reset by remounting: callers key the instance
 * on `step.id`, so React clears state when the active step changes.
 */
export function InterviewStep({
    step,
    initialValue,
    initialChoice,
    onSubmit,
    onSkip,
}: InterviewStepProps) {
    const [choice, setChoice] = useState<string | undefined>(initialChoice);
    const [text, setText] = useState(initialValue ?? "");

    const hasAnswer = Boolean(choice?.length || text.trim());

    const handleSubmit = () => {
        // If both a choice and free-text are set, combine them so the LLM sees
        // both the structured signal and the user's own words. The format step
        // uses the inline FormatSelector instead of local state, so fall back
        // to initialValue when the user has not typed anything of their own.
        const parts: string[] = [];
        if (choice) {
            const match = step.choices.find((c) => c.value === choice);
            if (match) parts.push(`[${match.label}]`);
        }
        if (text.trim()) parts.push(text.trim());
        const combined =
            parts.length > 0 ? parts.join(" ") : (initialValue?.trim() ?? "");
        if (!combined) return;
        onSubmit(combined);
    };

    return (
        <div className="flex flex-col gap-4">
            <div>
                <div className="text-[15px] leading-snug text-foreground">{step.question}</div>
                <div className="text-[13px] text-muted-foreground mt-1">{step.helperText}</div>
            </div>

            {step.id === "format" ? (
                <div className="flex items-center gap-2">
                    <span className="signal-mono">Format</span>
                    <FormatSelector />
                </div>
            ) : null}

            {step.choices.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {step.choices.map((c) => {
                        const active = choice === c.value;
                        return (
                            <button
                                key={c.value}
                                type="button"
                                onClick={() => setChoice(active ? undefined : c.value)}
                                className={cn(
                                    "text-left p-3 rounded-md border text-[13px] transition-colors",
                                    active
                                        ? "border-emerald-500/60 bg-emerald-500/10"
                                        : "chat-first-inset hover:border-border-hairline-strong",
                                )}
                            >
                                <div
                                    className={cn(
                                        "font-medium",
                                        active ? "text-emerald-500" : "text-foreground",
                                    )}
                                >
                                    {c.label}
                                </div>
                                <div
                                    className={cn(
                                        "text-[12px] mt-0.5",
                                        active ? "text-emerald-500/90" : "text-muted-foreground",
                                    )}
                                >
                                    {c.hint}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {step.id !== "format" && (
                <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/40 border border-border">
                    <span className="font-mono text-[13px] text-muted-foreground">&gt;</span>
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        placeholder={step.placeholder}
                        className="flex-1 bg-transparent border-none outline-none text-[14px] text-foreground placeholder:text-muted-foreground/70"
                    />
                </div>
            )}

            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                    <span>4 questions total · ~30 seconds</span>
                    {onSkip && (
                        <button
                            type="button"
                            onClick={onSkip}
                            className="font-mono uppercase tracking-wider hover:text-foreground transition-colors"
                        >
                            esc to exit
                        </button>
                    )}
                </div>
                <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={step.id !== "format" && !hasAnswer}
                    className="h-8 px-3 text-[12px]"
                >
                    Next ↵
                </Button>
            </div>
        </div>
    );
}
