import Link from "next/link";
import { CONNECTOR_DOCS_URL } from "@/lib/connector";

export function SiteFooter() {
    return (
        <footer className="border-t border-border print:hidden">
            <div className="prep-shell flex flex-col gap-4 py-8 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
                <p className="max-w-xl">
                    PokeMCP and VGC Teambuilder are published by Robert Borkowski as an unofficial
                    fan project. They are not affiliated with or endorsed by
                    Nintendo, Creatures Inc., GAME FREAK inc. or The Pokémon Company. Tournament
                    results come from Limitless; usage statistics come from Pokémon Showdown ladder
                    data published by Smogon.
                </p>
                <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
                    <Link href="/reports" className="hover:text-foreground">
                        Reports
                    </Link>
                    <a href={CONNECTOR_DOCS_URL} className="hover:text-foreground">
                        Connector
                    </a>
                    <Link href="/privacy" className="hover:text-foreground">
                        Privacy
                    </Link>
                    <Link href="/terms" className="hover:text-foreground">
                        Terms
                    </Link>
                    <Link href="/support" className="hover:text-foreground">
                        Support
                    </Link>
                </nav>
            </div>
        </footer>
    );
}
