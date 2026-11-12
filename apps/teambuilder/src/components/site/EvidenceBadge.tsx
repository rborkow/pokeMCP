import { Calculator, Newspaper } from "lucide-react";

/** How a figure on the page was obtained. */
export type EvidenceKind = "tournament-source" | "calculated";

const evidenceStyle: Record<
    EvidenceKind,
    { label: string; icon: typeof Newspaper; className: string }
> = {
    "tournament-source": {
        label: "Tournament source",
        icon: Newspaper,
        className: "border-primary/35 bg-primary/10 text-primary",
    },
    calculated: {
        label: "Calculated",
        icon: Calculator,
        className: "border-sage/35 bg-sage/10 text-sage",
    },
};

export function EvidenceBadge({ kind, label }: { kind: EvidenceKind; label?: string }) {
    const style = evidenceStyle[kind];
    const Icon = style.icon;
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${style.className}`}
        >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label ?? style.label}
        </span>
    );
}
