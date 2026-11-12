import Link from "next/link";
import type { ReactNode } from "react";
import { PrepHeader } from "@/components/prep/PrepHeader";

export const metadata = {
    title: "Privacy policy",
    description:
        "What the PokeMCP website and the VGC Teambuilder connector collect, why, who processes it, how long it is kept, and how to delete it.",
};

function Items({ children }: { children: ReactNode }) {
    return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

/**
 * Each section is self-contained so one can change without rewording the
 * others. In particular, "AI features on the website" describes everything
 * sent to the AI provider — if those features are removed, remove that
 * section and its line under "Who processes data".
 */
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
                <p>For each tool call we record:</p>
                <Items>
                    <li>which tool was called and for which format;</li>
                    <li>whether it succeeded and how long it took;</li>
                    <li>
                        a random identifier for the connection, created by our server, which is not
                        linked to you or to your assistant account.
                    </li>
                </Items>
                <p>
                    We use this to keep the connector reliable and to see which tools are useful.
                    Your assistant&apos;s provider handles your conversation under its own privacy
                    policy.
                </p>
            </>
        ),
    },
    {
        title: "The website without an account",
        body: (
            <>
                <p>
                    You can use the website without signing in. Teams and plans you create stay in
                    your browser&apos;s storage on your device, and you can export them from the{" "}
                    <Link href="/teams" className="prep-text-link">
                        Teams page
                    </Link>
                    .
                </p>
                <p>We collect a small amount of information from all visitors:</p>
                <Items>
                    <li>
                        <strong>Page statistics.</strong> Cloudflare Web Analytics counts page views
                        and measures page speed. It does not use cookies and does not store your IP
                        address.
                    </li>
                    <li>
                        <strong>Product events.</strong> We count a few actions, such as starting a
                        plan or exporting one, together with the format. These counts are not linked
                        to you.
                    </li>
                    <li>
                        <strong>Feedback.</strong> If you send feedback, we keep your message, the
                        page you sent it from and your email address if you chose to give one, and
                        we receive a copy by email.
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
        title: "Optional accounts",
        body: (
            <>
                <p>
                    Signing in with Discord or Google is optional and exists only to sync your
                    workspace between devices. If you sign in, we store:
                </p>
                <Items>
                    <li>
                        the account identifier and basic profile from the provider you chose: your
                        name, email address and profile image;
                    </li>
                    <li>the teams, plans and coach conversations you choose to sync;</li>
                    <li>
                        your sign-in sessions, including the IP address and browser they were
                        created from, which we use to keep the account secure.
                    </li>
                </Items>
                <p>
                    Signed-in sessions use secure, HTTP-only cookies. Sign-in tokens from Discord or
                    Google are encrypted before they are stored.
                </p>
            </>
        ),
    },
    {
        title: "AI features on the website",
        body: (
            <>
                <p>
                    The website&apos;s battle cards, coach, team builder chat and report questions
                    are generated by an AI model from Anthropic. When you use one, we send Anthropic
                    the team, matchup and message it needs to answer. The request passes through
                    Cloudflare&apos;s AI Gateway, which records usage figures and can keep a log of
                    requests for troubleshooting.
                </p>
                <p>
                    We do not use your teams or conversations to train AI models. The connector
                    described above does not use these features and sends nothing to Anthropic on
                    our behalf.
                </p>
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
                    <li>
                        <strong>Discord or Google</strong> processes your sign-in, if you choose to
                        sign in.
                    </li>
                    <li>
                        <strong>Anthropic</strong> processes the content described under AI features
                        on the website.
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
                    <strong>Connector and website usage counts:</strong> 3 months.
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
                    <strong>Feedback:</strong> until you ask us to delete it.
                </li>
                <li>
                    <strong>Account, synced teams, plans and coach conversations:</strong> until you
                    delete them or the account.
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
                        Delete synced teams, plans, coach conversations, sessions, sign-in links and
                        the account itself from the{" "}
                        <Link href="/account" className="prep-text-link">
                            account page
                        </Link>
                        . You can also revoke access in your Discord or Google account settings.
                    </li>
                    <li>
                        Clear your browser&apos;s site data to remove teams and plans kept on your
                        device.
                    </li>
                    <li>
                        Email us to have feedback or a shared team link removed, or to ask what we
                        hold about you.
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
            <PrepHeader />
            <main className="prep-shell pb-20 pt-10">
                <header className="border-b border-border pb-8">
                    <p className="text-sm text-muted-foreground">Last updated November 12, 2026</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                        Privacy policy
                    </h1>
                    <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
                        This policy covers the PokeMCP website and the VGC Teambuilder connector for
                        AI assistants. Both work without an account. The connector stores nothing
                        about you, and the website stores personal information only if you choose to
                        sign in or send feedback.
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
        </div>
    );
}
