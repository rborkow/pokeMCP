import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SavedWorkspaceExport } from "@/components/site/SavedWorkspaceExport";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CONNECTOR_DOCS_URL } from "@/lib/connector";

export const metadata: Metadata = {
    title: "PokeMCP Prep has been retired",
    description:
        "Matchup plans, saved teams and accounts on pokemcp.com have been retired. Team building now happens in Claude or ChatGPT with the VGC Teambuilder connector.",
    robots: { index: false, follow: true },
};

/**
 * Where the retired addresses (/prep, /teams, /account, /builder, /build)
 * land. See the redirects in next.config.ts.
 */
export default function RetiredPage() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <SiteHeader />
            <main className="prep-shell pb-20 pt-10 md:pt-16">
                <header className="border-b border-border pb-10">
                    <h1 className="max-w-[20ch] text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                        PokeMCP Prep has been retired
                    </h1>
                    <p className="mt-5 max-w-2xl text-pretty leading-7 text-muted-foreground">
                        Matchup plans, saved teams and accounts are no longer available here. Team
                        building now happens inside Claude or ChatGPT, using the VGC Teambuilder
                        connector for usage statistics, legality checks and type analysis.
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                        <a href={CONNECTOR_DOCS_URL} className="prep-button-primary">
                            Add VGC Teambuilder
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </a>
                        <Link href="/" className="prep-button-secondary">
                            Tournament results
                        </Link>
                        <Link href="/reports" className="prep-button-secondary">
                            Meta reports
                        </Link>
                    </div>
                </header>

                <div className="max-w-3xl divide-y divide-border">
                    <section className="py-8" aria-labelledby="browser-heading">
                        <h2 id="browser-heading" className="text-xl font-semibold">
                            Teams and plans saved in this browser
                        </h2>
                        <div className="mt-3">
                            <SavedWorkspaceExport />
                        </div>
                    </section>
                    <section className="py-8" aria-labelledby="account-heading">
                        <h2 id="account-heading" className="text-xl font-semibold">
                            Teams and plans synced to an account
                        </h2>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">
                            Signing in with Discord or Google is no longer possible. Anything you
                            synced before the retirement is still stored. Email{" "}
                            <a className="prep-text-link" href="mailto:feedback@pokemcp.com">
                                feedback@pokemcp.com
                            </a>{" "}
                            to get a copy or to have it deleted, and say which sign-in you used. The{" "}
                            <Link href="/privacy" className="prep-text-link">
                                privacy policy
                            </Link>{" "}
                            has the details.
                        </p>
                    </section>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
