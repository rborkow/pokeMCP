import Link from "next/link";
import { PrepHeader } from "@/components/prep/PrepHeader";

export const metadata = {
    title: "Privacy policy",
    description: "How PokeMCP Prep collects, uses, stores, and deletes account and preparation data.",
};

const sections = [
    {
        title: "What we collect",
        body: (
            <>
                <p>
                    You can use PokeMCP Prep without an account. Anonymous teams and plans stay in
                    your browser. If you sign in with Discord or Google, we store the provider
                    account identifier and basic profile information needed to create your account,
                    such as your name, email address, and profile image.
                </p>
                <p>
                    When sync is enabled, we store the teams, prep plans, and matchup-coach history
                    you choose to save. We also process limited operational data such as session
                    identifiers, timestamps, IP address, browser user agent, error details, and
                    product-funnel events for security, reliability, and product measurement.
                </p>
            </>
        ),
    },
    {
        title: "How we use and share data",
        body: (
            <>
                <p>
                    We use this data to authenticate you, sync your workspace, generate matchup
                    guidance, prevent abuse, diagnose failures, and understand whether the product is
                    useful. Team and coach content is not used for model training unless you
                    explicitly opt in to a future sharing feature.
                </p>
                <p>
                    Cloudflare hosts the application, databases, security controls, and operational
                    analytics. Discord or Google processes the sign-in you choose. Anthropic
                    processes the team and matchup context needed to generate AI-assisted battle
                    cards and coach replies. We do not sell personal information.
                </p>
            </>
        ),
    },
    {
        title: "Cookies and retention",
        body: (
            <>
                <p>
                    Signed-in sessions use secure, HTTP-only cookies. Cloudflare Web Analytics may
                    collect privacy-oriented traffic measurements. Synced product data and account
                    records remain until you delete the account; operational logs and aggregate
                    analytics are retained only as long as they are useful for security and service
                    operation.
                </p>
                <p>
                    OAuth access tokens are encrypted at rest. Provider client secrets and the
                    application signing secret are stored as Cloudflare Worker secrets and are never
                    sent to the browser.
                </p>
            </>
        ),
    },
    {
        title: "Your choices",
        body: (
            <p>
                You can export anonymous workspace data from the Teams page. Signed-in users can
                delete synced teams, plans, coach history, sessions, provider links, and the account
                from the{" "}
                <Link href="/account" className="prep-text-link">
                    account page
                </Link>
                . You can also revoke PokeMCP Prep in your Discord or Google account settings.
            </p>
        ),
    },
];

export default function PrivacyPage() {
    return (
        <div className="min-h-screen">
            <PrepHeader />
            <main className="prep-shell pb-20 pt-10">
                <header className="border-b border-border pb-8">
                    <p className="text-sm text-muted-foreground">Last updated July 13, 2026</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                        Privacy policy
                    </h1>
                    <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
                        PokeMCP Prep is designed for complete anonymous use. An account is optional
                        and exists only to keep your preparation workspace in sync.
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
                            Questions or privacy requests can be sent to{" "}
                            <a className="prep-text-link" href="mailto:feedback@pokemcp.com">
                                feedback@pokemcp.com
                            </a>
                            .
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
}
