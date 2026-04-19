"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type EmptyStateCTAsProps = {
    /** Variant controls hierarchy: primary is highest emphasis (landing hero), inline fits inside a chat empty state. */
    variant?: "primary" | "inline";
    className?: string;
};

/**
 * The three CTAs that must stay in sync between the landing hero and the
 * in-app empty state (per design brief). Phase 1 ships both endpoints as
 * `/builder` with query-string hints; Phase 3 replaces the interview hint
 * with the real LLM-driven interview.
 */
export function EmptyStateCTAs({ variant = "primary", className }: EmptyStateCTAsProps) {
    const isPrimary = variant === "primary";

    return (
        <div className={cn("flex flex-wrap gap-2.5", className)}>
            <Link
                href="/builder?start=interview"
                className={cn(
                    "inline-flex items-center justify-center rounded-md border font-medium transition-colors",
                    isPrimary
                        ? "bg-foreground text-background border-foreground hover:bg-foreground/90 px-4 py-2.5 text-sm"
                        : "bg-foreground/95 text-background border-foreground/95 hover:bg-foreground px-3 py-2 text-[13px]",
                )}
            >
                Start the interview
            </Link>
            <Link
                href="/builder?start=import"
                className={cn(
                    "inline-flex items-center justify-center rounded-md border border-border bg-transparent font-medium text-foreground transition-colors hover:bg-muted",
                    isPrimary ? "px-4 py-2.5 text-sm" : "px-3 py-2 text-[13px]",
                )}
            >
                Import from Showdown
            </Link>
            <Link
                href="/builder?start=empty"
                className={cn(
                    "inline-flex items-center justify-center rounded-md border border-border/60 bg-transparent font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-border",
                    isPrimary ? "px-4 py-2.5 text-sm" : "px-3 py-2 text-[13px]",
                )}
            >
                Open empty builder
            </Link>
        </div>
    );
}
