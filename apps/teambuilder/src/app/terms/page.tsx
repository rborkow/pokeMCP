import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata = {
    title: "Terms of use",
    description:
        "The terms for using the PokeMCP website and the VGC Teambuilder connector: what they are, what they are not, and what you can expect from the data.",
};

function Items({ children }: { children: ReactNode }) {
    return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

const sections: { title: string; body: ReactNode }[] = [
    {
        title: "What PokeMCP is",
        body: (
            <p>
                PokeMCP is an independent fan project. It publishes Pokémon Champions tournament
                results and usage reports on this website, and it runs VGC Teambuilder, a connector
                that lets an AI assistant such as Claude or ChatGPT look up the same data. Both are
                free to use and need no account.
            </p>
        ),
    },
    {
        title: "Not official, and not affiliated",
        body: (
            <>
                <p>
                    PokeMCP is not affiliated with or endorsed by Nintendo, Creatures Inc., GAME
                    FREAK inc. or The Pokémon Company. Pokémon and Pokémon character names are
                    trademarks of their owners.
                </p>
                <p>
                    Nothing here is an official ruling. Before you enter a tournament, check the
                    official rules and the official list of eligible Pokémon for that event.
                </p>
            </>
        ),
    },
    {
        title: "The data can be wrong",
        body: (
            <>
                <p>
                    The data comes from other parties: tournament results from Limitless, usage
                    statistics from Pokémon Showdown ladder data published by Smogon, Pokémon and
                    move data from Pokémon Showdown, and each regulation&apos;s published list of
                    eligible Pokémon. It can be incomplete, out of date or mistaken, and we may
                    process it incorrectly.
                </p>
                <p>
                    Team and move checks are an aid, not a guarantee. The website, the connector and
                    everything they return are provided as they are, without warranties of any kind.
                </p>
            </>
        ),
    },
    {
        title: "Using the website and the connector",
        body: (
            <>
                <p>You may use both freely, including through automated clients. Please do not:</p>
                <Items>
                    <li>send traffic at a volume that degrades the service for others;</li>
                    <li>try to get around rate limits or other technical limits;</li>
                    <li>attempt to break into, disrupt or damage the service;</li>
                    <li>use the service to break the law or someone else&apos;s rights.</li>
                </Items>
                <p>We may limit or block traffic that does any of these.</p>
            </>
        ),
    },
    {
        title: "Your AI assistant",
        body: (
            <p>
                When you use the connector through an AI assistant, that assistant is provided by
                its own company under its own terms and privacy policy. The connector only answers
                the requests the assistant sends it. We are not responsible for what the assistant
                says or does with the data it receives.
            </p>
        ),
    },
    {
        title: "Changes and availability",
        body: (
            <p>
                PokeMCP is run in spare time. We may change, limit, suspend or end any part of it at
                any time, and features have been retired before. We may also update these terms;
                when we do, we will update this page and the date at the top.
            </p>
        ),
    },
    {
        title: "Liability",
        body: (
            <p>
                To the extent the law allows, we are not liable for any loss or damage that comes
                from using the website or the connector, or from relying on the data they provide.
            </p>
        ),
    },
    {
        title: "Source code and privacy",
        body: (
            <p>
                The source code is published under the GNU Affero General Public License v3.0 at{" "}
                <a className="prep-text-link" href="https://github.com/rborkow/pokeMCP">
                    github.com/rborkow/pokeMCP
                </a>
                . How we handle data is described in the{" "}
                <Link href="/privacy" className="prep-text-link">
                    privacy policy
                </Link>
                .
            </p>
        ),
    },
];

export default function TermsPage() {
    return (
        <div className="min-h-screen">
            <SiteHeader />
            <main className="prep-shell pb-20 pt-10">
                <header className="border-b border-border pb-8">
                    <p className="text-sm text-muted-foreground">Last updated November 12, 2026</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                        Terms of use
                    </h1>
                    <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
                        These terms cover the PokeMCP website, its documentation and the VGC
                        Teambuilder connector for AI assistants. By using them you agree to these
                        terms. If you do not agree, please do not use them.
                    </p>
                </header>
                <div className="max-w-3xl divide-y divide-border">
                    {sections.map((section) => (
                        <section key={section.title} className="py-8">
                            <h2 className="text-xl font-semibold">{section.title}</h2>
                            <div className="mt-3 space-y-4 text-sm leading-7 text-muted-foreground">
                                {section.body}
                            </div>
                        </section>
                    ))}
                    <section className="py-8">
                        <h2 className="text-xl font-semibold">Contact</h2>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">
                            Questions about these terms can be sent to{" "}
                            <a className="prep-text-link" href="mailto:feedback@pokemcp.com">
                                feedback@pokemcp.com
                            </a>
                            .
                        </p>
                    </section>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
