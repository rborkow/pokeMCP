import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CONNECTOR_DOCS_URL, CONNECTOR_MCP_URL, CONNECTOR_NAME } from "@/lib/connector";

export const metadata = {
    title: "Support",
    description:
        "Help with the VGC Teambuilder connector and the PokeMCP website: how to connect, what to check when something looks wrong, and how to report a problem.",
};

const ISSUES_URL = "https://github.com/rborkow/pokeMCP/issues";
const SUPPORT_EMAIL = "feedback@pokemcp.com";

function Items({ children }: { children: ReactNode }) {
    return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

const sections: { title: string; body: ReactNode }[] = [
    {
        title: "Connecting",
        body: (
            <p>
                {CONNECTOR_NAME} is added to an AI assistant by its address,{" "}
                <code className="font-mono text-[0.9em] text-foreground">{CONNECTOR_MCP_URL}</code>.
                It needs no account and no sign-in. The{" "}
                <a className="prep-text-link" href={CONNECTOR_DOCS_URL}>
                    getting started guide
                </a>{" "}
                has the steps for each assistant and examples of what to ask.
            </p>
        ),
    },
    {
        title: "Things to check first",
        body: (
            <Items>
                <li>
                    <strong className="font-medium text-foreground">
                        The assistant answers without using the connector.
                    </strong>{" "}
                    Check that {CONNECTOR_NAME} is turned on for the conversation, then ask again
                    and mention it by name.
                </li>
                <li>
                    <strong className="font-medium text-foreground">
                        Usage statistics are unavailable for a regulation.
                    </strong>{" "}
                    Statistics are published once a month, so a new regulation has none until its
                    first month is out. Trend questions need two or three months of history. Ask
                    which formats are supported to see what is available now.
                </li>
                <li>
                    <strong className="font-medium text-foreground">
                        A Pokémon, Mega Evolution or move is missing or rejected.
                    </strong>{" "}
                    Our Pokémon data can lag the game after an update. Check the official list for
                    your event, and tell us so we can add it.
                </li>
                <li>
                    <strong className="font-medium text-foreground">
                        A tournament is not on the results pages.
                    </strong>{" "}
                    Results are collected from Limitless once a day, and only for finished events
                    with at least 48 players.
                </li>
            </Items>
        ),
    },
    {
        title: "Report a problem",
        body: (
            <>
                <p>
                    Email{" "}
                    <a className="prep-text-link" href={`mailto:${SUPPORT_EMAIL}`}>
                        {SUPPORT_EMAIL}
                    </a>{" "}
                    or open an issue at{" "}
                    <a className="prep-text-link" href={ISSUES_URL}>
                        github.com/rborkow/pokeMCP/issues
                    </a>
                    . It helps to include:
                </p>
                <Items>
                    <li>what you asked, and the answer you got;</li>
                    <li>which assistant you were using;</li>
                    <li>the regulation, Pokémon or tournament involved;</li>
                    <li>what you expected instead.</li>
                </Items>
                <p>
                    Issues on GitHub are public, so leave out anything personal. PokeMCP is run in
                    spare time, and a reply can take a few days.
                </p>
            </>
        ),
    },
    {
        title: "Questions about your AI assistant",
        body: (
            <p>
                Your assistant&apos;s account, billing and settings belong to the company that
                provides it, as does anything it says beyond the data the connector returns. Their
                support team can help with those.
            </p>
        ),
    },
    {
        title: "Privacy and terms",
        body: (
            <p>
                What the website and the connector record is described in the{" "}
                <Link href="/privacy" className="prep-text-link">
                    privacy policy
                </Link>
                , and the rules for using them are in the{" "}
                <Link href="/terms" className="prep-text-link">
                    terms of use
                </Link>
                . Privacy requests go to the same email address.
            </p>
        ),
    },
];

export default function SupportPage() {
    return (
        <div className="min-h-screen">
            <SiteHeader />
            <main className="prep-shell pb-20 pt-10">
                <header className="border-b border-border pb-8">
                    <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                        Support
                    </h1>
                    <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
                        Help with the {CONNECTOR_NAME} connector and this website. If something is
                        wrong or missing, we want to hear about it.
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
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
