"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePrepStore } from "@/stores/prep-store";

export function ContinuePrep() {
    const plans = usePrepStore((state) => state.plans);
    const recent = [...plans]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 2);

    if (recent.length === 0) {
        return (
            <div className="border-y border-border py-6">
                <p className="text-sm font-medium text-foreground">Your prep desk is clear.</p>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                    Choose a published team below or paste an opponent to create your first battle card.
                </p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-border border-y border-border">
            {recent.map((plan) => (
                <Link
                    key={plan.id}
                    href={`/prep/${plan.id}`}
                    className="group flex items-center justify-between gap-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
                    <span>
                        <span className="block text-sm font-medium text-foreground">
                            {plan.ownTeam.name} into {plan.opponentTeam.name}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                            Updated {new Date(plan.updatedAt).toLocaleDateString()}
                        </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                </Link>
            ))}
        </div>
    );
}
