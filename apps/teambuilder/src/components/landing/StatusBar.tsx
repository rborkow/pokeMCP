import pkg from "../../../package.json";

const BUILD_DATE = new Date().toISOString().slice(0, 10);

export function StatusBar() {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 text-emerald-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                LIVE
            </span>
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
