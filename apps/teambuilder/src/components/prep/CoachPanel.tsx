"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { EvidenceBadge } from "@/components/prep/EvidenceBadge";
import { getWorkspaceId } from "@/lib/prep/workspace-id";
import { trackPrepEvent } from "@/lib/prep/analytics";
import type { CoachMessage, PrepPlan } from "@/lib/prep/schema";
import { usePrepStore } from "@/stores/prep-store";

const EMPTY_COACH_MESSAGES: CoachMessage[] = [];

export function CoachPanel({ plan }: { plan: PrepPlan }) {
    const messages = usePrepStore(
        (state) => state.coachMessages[plan.id] ?? EMPTY_COACH_MESSAGES,
    );
    const addMessage = usePrepStore((state) => state.addCoachMessage);
    const clearHistory = usePrepStore((state) => state.clearCoachHistory);
    const [question, setQuestion] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        const trimmed = question.trim();
        if (!trimmed || isSending) return;
        setQuestion("");
        setError(null);
        setIsSending(true);
        const userMessage = {
            id: crypto.randomUUID(),
            planId: plan.id,
            role: "user" as const,
            content: trimmed,
            createdAt: new Date().toISOString(),
        };
        addMessage(userMessage);
        try {
            const response = await fetch("/api/prep/coach", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Prep-Workspace": getWorkspaceId(),
                },
                body: JSON.stringify({
                    plan,
                    question: trimmed,
                    history: messages.slice(-20).map(({ role, content }) => ({ role, content })),
                }),
            });
            const result = (await response.json()) as { answer?: string; error?: string };
            if (!response.ok || !result.answer) throw new Error(result.error ?? "Coach request failed.");
            addMessage({
                id: crypto.randomUUID(),
                planId: plan.id,
                role: "assistant",
                content: result.answer,
                createdAt: new Date().toISOString(),
            });
            trackPrepEvent("coach_followup", { format: plan.format });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "The coach is unavailable.");
        } finally {
            setIsSending(false);
        }
    }

    return (
        <section className="border-t border-border pt-8 print:hidden" aria-labelledby="coach-heading">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 id="coach-heading" className="text-xl font-semibold">Ask about this plan</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">The coach sees only this matchup, its evidence, and the conversation below. Suggestions do not silently rewrite your battle card.</p>
                </div>
                <EvidenceBadge kind="model-suggestion" />
            </div>
            {messages.length > 0 && (
                <div className="mt-6 space-y-4" aria-live="polite">
                    {messages.map((message) => (
                        <div key={message.id} className={message.role === "user" ? "ml-auto max-w-2xl rounded-lg bg-inset p-4" : "max-w-3xl border-l border-border pl-4"}>
                            <p className="mb-1 text-xs text-muted-foreground">{message.role === "user" ? "You" : "Matchup coach"}</p>
                            <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                        </div>
                    ))}
                    <button type="button" onClick={() => clearHistory(plan.id)} className="prep-text-link text-muted-foreground">Clear coach history</button>
                </div>
            )}
            <form onSubmit={submit} className="mt-6">
                <label htmlFor="coach-question" className="text-sm font-medium">Question about this matchup</label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <textarea id="coach-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2_000} rows={3} className="prep-field resize-y" placeholder="What should I preserve if they lead Farigiraf + Torkoal?" />
                    <button type="submit" disabled={isSending || !question.trim()} className="prep-button-primary self-stretch justify-center disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto">
                        <Send className="h-4 w-4" aria-hidden="true" /> {isSending ? "Thinking…" : "Ask coach"}
                    </button>
                </div>
                {error && <p role="alert" className="mt-3 text-sm text-rust">{error}</p>}
            </form>
        </section>
    );
}
