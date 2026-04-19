export function DeveloperFooter() {
    return (
        <footer className="bg-muted/40 border-t border-border px-6 md:px-10 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        For developers
                    </div>
                    <div className="mt-1 text-[14px] text-foreground">
                        Built on Model Context Protocol. Point your own agent at the data.
                    </div>
                </div>
                <nav aria-label="Developer resources" className="flex gap-2">
                    <a
                        href="https://docs.pokemcp.com"
                        className="inline-flex items-center rounded-md border border-border bg-transparent px-3.5 py-1.5 font-mono text-[13px] text-foreground transition-colors hover:bg-muted"
                    >
                        docs
                    </a>
                    <a
                        href="https://api.pokemcp.com"
                        className="inline-flex items-center rounded-md border border-border bg-transparent px-3.5 py-1.5 font-mono text-[13px] text-foreground transition-colors hover:bg-muted"
                    >
                        api
                    </a>
                    <a
                        href="https://github.com/rborkow/pokeMCP"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md border border-border bg-transparent px-3.5 py-1.5 font-mono text-[13px] text-foreground transition-colors hover:bg-muted"
                    >
                        github
                    </a>
                </nav>
            </div>
        </footer>
    );
}
