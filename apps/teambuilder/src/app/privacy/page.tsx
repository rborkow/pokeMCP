import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata = {
    title: "Privacy policy",
    description:
        "What the PokeMCP website and the VGC Teambuilder connector collect, why, who processes it, how long it is kept, and how to delete it.",
};

function Items({ children }: { children: ReactNode }) {
    return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

const sections: { title: string; body: ReactNode }[] = [
    {
        title: "VGC Teambuilder connector",
        body: (
            <>
                <p>
                    VGC Teambuilder is the connector you can add to an AI assistant such as Claude
                    or ChatGPT. It has no accounts and never asks for personal information. Its
                    tools only read Pokémon data.
                </p>
                <p>
                    When your assistant calls a tool, it sends us that tool&apos;s inputs: Pokémon
                    names, team lists, move names and format names. We use them to answer the call
                    and do not store them. We do not receive your conversation, your name, your
                    email address or your assistant account.
                </p>
                <p>For each request your assistant makes we record:</p>
                <Items>
                    <li>
                        what kind of request it was and, for a tool call, which tool was called and
                        for which format;
                    </li>
                    <li>whether it succeeded and how long it took;</li>
                    <li>
                        which assistant software made it, such as Claude or ChatGPT, taken from the
                        name and version that software reports about itself. This identifies the
                        software, not you or your assistant account.
                    </li>
                </Items>
                <p>
                    We use this to keep the connector reliable and to see which tools are useful.
                    Your assistant&apos;s provider handles your conversation under its own privacy
                    policy. We do not use anything you send to train AI models.
                </p>
            </>
        ),
    },
    {
        title: "The website",
        body: (
            <>
                <p>
                    The website publishes tournament results and meta reports. It has no accounts
                    and no forms, and it does not ask for personal information.
                </p>
                <Items>
                    <li>
                        <strong>Page statistics.</strong> Cloudflare Web Analytics counts page views
                        and measures page speed. It does not use cookies and does not store your IP
                        address.
                    </li>
                    <li>
                        <strong>Shared team links.</strong> A team shared through an older{" "}
                        <code>/t/</code> link is stored so the link keeps working. New links can no
                        longer be created.
                    </li>
                </Items>
            </>
        ),
    },
    {
        title: "Retired features and the data they left",
        body: (
            <>
                <p>
                    The website used to offer matchup plans, saved teams, a coach and optional
                    accounts under the name PokeMCP Prep. These were retired in November 2026.
                </p>
                <Items>
                    <li>
                        <strong>In your browser.</strong> Teams and plans you saved without an
                        account were kept in your browser&apos;s storage and are still there. You
                        can download them from the{" "}
                        <Link href="/retired" className="prep-text-link">
                            retirement notice
                        </Link>
                        , and clearing your browser&apos;s site data removes them.
                    </li>
                    <li>
                        <strong>In an account.</strong> If you signed in with Discord or Google,
                        your account, your sign-in sessions and the teams, plans and coach
                        conversations you synced were deleted when the accounts were retired. We no
                        longer hold them, and the sign-in apps have been removed.
                    </li>
                    <li>
                        <strong>Feedback.</strong> Messages sent through the site&apos;s former
                        feedback form, with the email address if one was given, are still stored.
                    </li>
                </Items>
            </>
        ),
    },
    {
        title: "Who processes data",
        body: (
            <>
                <p>We do not sell personal information and we do not show advertising.</p>
                <Items>
                    <li>
                        <strong>Cloudflare</strong> hosts the website, the connector and their
                        databases. It processes the IP address of every request to route it, to
                        apply rate limits and to keep short-lived request logs. When you use the
                        connector, that address belongs to your assistant&apos;s provider rather
                        than to you.
                    </li>
                </Items>
            </>
        ),
    },
    {
        title: "How long we keep it",
        body: (
            <Items>
                <li>
                    <strong>Connector tool inputs and results:</strong> not stored.
                </li>
                <li>
                    <strong>Connector usage counts:</strong> 3 months.
                </li>
                <li>
                    <strong>Request logs:</strong> up to 7 days.
                </li>
                <li>
                    <strong>Page statistics:</strong> up to 6 months, in aggregate.
                </li>
                <li>
                    <strong>Shared team links:</strong> 1 year after the link was last opened.
                </li>
                <li>
                    <strong>Feedback sent through the site&apos;s former feedback form:</strong>{" "}
                    until you ask us to delete it.
                </li>
            </Items>
        ),
    },
    {
        title: "Your choices",
        body: (
            <>
                <Items>
                    <li>
                        Remove the connector from your AI assistant at any time. Nothing about you
                        is left with us to delete.
                    </li>
                    <li>
                        Clear your browser&apos;s site data to remove teams and plans the retired
                        features left on your device.
                    </li>
                    <li>
                        Email us to have a shared team link or earlier feedback removed, or to ask
                        what we hold about you.
                    </li>
                </Items>
                <p>
                    The website and the connector are not directed to children under 13, and we do
                    not knowingly collect their personal information.
                </p>
            </>
        ),
    },
];

export default function PrivacyPage() {
    return (
        <div className="min-h-screen">
            <SiteHeader />
            <main className="prep-shell pb-20 pt-10">
                <header className="border-b border-border pb-8">
                    <p className="text-sm text-muted-foreground">Last updated November 12, 2026</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                        Privacy policy
                    </h1>
                    <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
                        This policy covers the PokeMCP website and the VGC Teambuilder connector for
                        AI assistants. Both work without an account. The connector stores nothing
                        about you, and the website collects none. Neither sends your data to an AI
                        provider. A little data remains from features the website has retired; that
                        is described below.
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
                        <h2 className="text-xl font-semibold">Changes and contact</h2>
                        <div className="mt-3 space-y-4 text-sm leading-7 text-muted-foreground">
                            <p>
                                If this policy changes, we will update this page and the date at the
                                top.
                            </p>
                            <p>
                                Questions and privacy requests can be sent to{" "}
                                <a className="prep-text-link" href="mailto:feedback@pokemcp.com">
                                    feedback@pokemcp.com
                                </a>
                                .
                            </p>
                        </div>
                    </section>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
