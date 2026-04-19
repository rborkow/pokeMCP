import { IS_BETA } from "@/lib/release";
import { cn } from "@/lib/utils";

export interface BetaBadgeProps {
    /** "chrome" = header pill (bg tint); "inline" = status-bar text segment (no bg). */
    variant?: "chrome" | "inline";
    className?: string;
}

/**
 * Small BETA chip. Renders nothing when IS_BETA is false, so the call site
 * doesn't need to conditionally include it.
 */
export function BetaBadge({ variant = "chrome", className }: BetaBadgeProps) {
    if (!IS_BETA) return null;

    if (variant === "inline") {
        return (
            <span
                className={cn(
                    "font-mono text-[11px] uppercase tracking-wider text-amber-500",
                    className,
                )}
            >
                Beta
            </span>
        );
    }

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-wider text-amber-500",
                className,
            )}
        >
            Beta
        </span>
    );
}
