const moments = [
    {
        index: "01",
        label: "Conception",
        title: "Talk it out",
        body: "Interview replaces the blank grid. Describe a vibe, a core, a matchup to beat — get a starting team with reasoning.",
    },
    {
        index: "02",
        label: "Refinement",
        title: "Iterate in English",
        body: '"Swap Rillaboom for something that beats Garchomp." "Tune this spread for the Incineroar mirror." No menus, no guessing.',
    },
    {
        index: "03",
        label: "Match prep",
        title: "Walk in with a plan",
        body: "Paste your opponent's team. Get lead recs, expected sequences, and the lines that win the matchup most often.",
    },
];

export function ThreeMoments() {
    return (
        <section className="px-6 md:px-10 pb-10">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
                The coach shows up at every step
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {moments.map((m) => (
                    <div key={m.index} className="rounded-lg border border-border bg-card p-4">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {m.index} — {m.label}
                        </div>
                        <h3 className="mt-2 text-[15px] font-medium text-foreground">{m.title}</h3>
                        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                            {m.body}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}
