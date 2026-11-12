"use client";

import Link from "next/link";
import { EvidenceBadge } from "@/components/prep/EvidenceBadge";
import type { CoachMessage, PrepPlan } from "@/lib/prep/schema";
import { usePrepStore } from "@/stores/prep-store";

const EMPTY_COACH_MESSAGES: CoachMessage[] = [];

/**
 * Read-only view of a plan's saved coach conversation.
 *
 * The matchup coach has been retired, so nothing new can be asked. Earlier
 * conversations stay with the plan — in the browser, in synced accounts and
 * in workspace exports. Renders nothing for a plan that never had one.
 *
 * The button clears this browser's copy only. Sync is merge-only and never
 * removes messages on the server, so a signed-in player's conversation comes
 * back on the next sync; the synced copy goes when they delete their account
 * data. The copy says so rather than promising a deletion it cannot make.
 */
export function CoachHistory({ plan }: { plan: PrepPlan }) {
    const messages = usePrepStore((state) => state.coachMessages[plan.id] ?? EMPTY_COACH_MESSAGES);
    const clearHistory = usePrepStore((state) => state.clearCoachHistory);

    if (messages.length === 0) return null;

    return (
        <section
            className="border-t border-border pt-8 print:hidden"
            aria-labelledby="coach-history-heading"
        >
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 id="coach-history-heading" className="text-xl font-semibold">
                        Saved coach conversation
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        The matchup coach has been retired, so you can no longer ask new questions.
                        Your earlier conversation about this plan is kept here.
                    </p>
                </div>
                <EvidenceBadge kind="model-suggestion" />
            </div>
            <div className="mt-6 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={
                            message.role === "user"
                                ? "ml-auto max-w-2xl rounded-lg bg-inset p-4"
                                : "max-w-3xl border-l border-border pl-4"
                        }
                    >
                        <p className="mb-1 text-xs text-muted-foreground">
                            {message.role === "user" ? "You" : "Matchup coach"}
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => clearHistory(plan.id)}
                    className="prep-text-link text-muted-foreground"
                >
                    Remove from this browser
                </button>
                <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
                    If you sync with an account, the synced copy stays until you delete your account
                    data on the{" "}
                    <Link href="/account" className="prep-text-link">
                        account page
                    </Link>
                    .
                </p>
            </div>
        </section>
    );
}
