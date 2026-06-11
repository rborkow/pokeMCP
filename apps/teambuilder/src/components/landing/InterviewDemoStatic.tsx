/**
 * Static HTML preview of the LLM-driven interview mid-flow. Phase 1 ships
 * this as a visual demonstration only — no API calls, no interactivity.
 * Phase 3 may swap it for a live single-step preview.
 */
export function InterviewDemoStatic() {
    return (
        <section className="px-6 md:px-10 pb-8">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        Interview · Step 2 of 4
                    </span>
                    <div className="flex gap-1" aria-hidden>
                        <span className="w-[18px] h-[3px] rounded-sm bg-emerald-500" />
                        <span className="w-[18px] h-[3px] rounded-sm bg-emerald-500" />
                        <span className="w-[18px] h-[3px] rounded-sm bg-border" />
                        <span className="w-[18px] h-[3px] rounded-sm bg-border" />
                    </div>
                </div>

                <div className="p-4 md:p-5">
                    <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/60 mb-4">
                        <span className="font-mono text-[11px] text-muted-foreground">01</span>
                        <span className="text-[13px] text-muted-foreground">Format</span>
                        <span className="ml-auto text-[13px] font-medium text-foreground">
                            Champions · Reg MA
                        </span>
                    </div>

                    <div className="flex gap-3 items-start mb-3">
                        <span className="font-mono text-[11px] text-muted-foreground mt-[3px]">
                            02
                        </span>
                        <div>
                            <div className="text-[15px] leading-tight text-foreground">
                                Where do you want to start?
                            </div>
                            <div className="text-[13px] text-muted-foreground mt-0.5">
                                {
                                    "Pick the one that feels closest. I'll adapt the next question based on your answer."
                                }
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                        <div className="text-left p-3 rounded-md border border-border text-[13px]">
                            <div className="font-medium text-foreground">Clean slate</div>
                            <div className="text-muted-foreground text-[12px]">
                                Surprise me with a strong team
                            </div>
                        </div>
                        <div className="text-left p-3 rounded-md border border-emerald-500/60 bg-emerald-500/10 text-[13px]">
                            <div className="font-medium text-emerald-500">Pokémon in mind</div>
                            <div className="text-emerald-500/90 text-[12px]">
                                Build around specific picks
                            </div>
                        </div>
                        <div className="text-left p-3 rounded-md border border-border text-[13px]">
                            <div className="font-medium text-foreground">Archetype</div>
                            <div className="text-muted-foreground text-[12px]">
                                TR, rain, HO, stall, balance
                            </div>
                        </div>
                        <div className="text-left p-3 rounded-md border border-border text-[13px]">
                            <div className="font-medium text-foreground">Counter a team</div>
                            <div className="text-muted-foreground text-[12px]">
                                Paste a Showdown set to beat
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/60 mb-3">
                        <span className="font-mono text-muted-foreground text-[13px]">&gt;</span>
                        <span className="flex-1 text-[14px] text-muted-foreground/80">
                            Ursaluna-Bloodmoon, Hatterene…
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-foreground text-background px-2.5 py-1 text-[12px] font-medium">
                            Next
                            <span className="font-mono">↵</span>
                        </span>
                    </div>

                    <div className="flex justify-between text-[12px] text-muted-foreground">
                        <span>4 questions total · ~30 seconds · skip anytime</span>
                        <span className="font-mono">esc to exit</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
