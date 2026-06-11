import { IS_BETA } from "@/lib/release";
import pkg from "../../../package.json";
import { BetaBadge } from "./BetaBadge";

// NEXT_PUBLIC_BUILD_DATE is baked in at build time. In dev we fall back to
// today's date so the badge always renders something sensible.
const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? new Date().toISOString().slice(0, 10);

export function StatusBar() {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 text-emerald-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                LIVE
            </span>
            {IS_BETA && (
                <>
                    <span aria-hidden>/</span>
                    <BetaBadge variant="inline" />
                </>
            )}
            <span aria-hidden>/</span>
            <span>Reg M-A + Gen 9 OU</span>
            <span aria-hidden>/</span>
            <span>AI-native</span>
            <span aria-hidden>/</span>
            <span>
                v{pkg.version} · {BUILD_DATE}
            </span>
        </div>
    );
}
