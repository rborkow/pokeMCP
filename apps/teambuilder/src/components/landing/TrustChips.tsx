const chips = [
    { color: "bg-violet-500", text: "Live meta · refreshed every tour" },
    { color: "bg-sky-500", text: "Showdown paste in / out, lossless" },
    { color: "bg-amber-500", text: "Threat matrix + speed tiers built-in" },
];

export function TrustChips() {
    return (
        <section className="mx-6 md:mx-10 pt-4 pb-10 border-t border-border">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted-foreground">
                {chips.map((c) => (
                    <li key={c.text} className="inline-flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${c.color}`} aria-hidden />
                        {c.text}
                    </li>
                ))}
            </ul>
        </section>
    );
}
