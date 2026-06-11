import Link from "next/link";
import type { ReactNode } from "react";
import { ReportChat } from "@/components/reports/ReportChat";
import { formatMonthLong, type ReportEntry } from "@/lib/reports";

const SITE_URL = "https://www.pokemcp.com";

interface ReportShellProps {
    report: ReportEntry;
    /** The canonical path for this rendering of the report (latest page vs monthly archive). */
    canonicalPath: string;
    children: ReactNode;
}

/**
 * Server-rendered article wrapper for meta reports. AI crawlers execute no
 * JavaScript, so everything meaningful here — headline, dates, sources, the
 * MDX body — must land in the initial HTML. The JSON-LD mirrors data that is
 * already visible in the markup; never put a number only in the JSON-LD.
 */
export function ReportShell({ report, canonicalPath, children }: ReportShellProps) {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: report.title,
        description: report.description,
        datePublished: report.datePublished,
        dateModified: report.dateModified,
        mainEntityOfPage: `${SITE_URL}${canonicalPath}`,
        author: { "@type": "Organization", name: "PokeMCP", url: SITE_URL },
        publisher: { "@type": "Organization", name: "PokeMCP", url: SITE_URL },
    };

    return (
        <article className="mx-auto w-full max-w-3xl px-4 py-10">
            <script
                type="application/ld+json"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD built from our own manifest; "<" escaped to prevent script breakout
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
                }}
            />
            <header className="mb-8 border-b border-border pb-6">
                <p className="signal-mono mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Link href="/reports" className="hover:text-foreground">
                        Meta Reports
                    </Link>{" "}
                    / {report.formatName}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                    {report.title}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                    Data through {formatMonthLong(report.dataThrough)} · Published{" "}
                    {report.datePublished} · Updated {report.dateModified}
                </p>
            </header>

            {children}

            <div className="mt-12">
                <ReportChat slug={report.slug} month={report.month} reportTitle={report.title} />
            </div>

            <footer className="mt-12 space-y-6 border-t border-border pt-6">
                <section>
                    <h2 className="signal-mono mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                        Data sources
                    </h2>
                    <ul className="space-y-1 text-sm">
                        {report.sources.map((source) => (
                            <li key={source.url}>
                                <a
                                    href={source.url}
                                    className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                    rel="noopener"
                                >
                                    {source.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Usage percentages are weighted Pokémon Showdown ladder statistics published
                        monthly by Smogon. Tables are generated directly from the raw data.
                    </p>
                </section>
                <section className="chat-first-panel rounded-lg p-5">
                    <h2 className="text-base font-semibold text-foreground">
                        Build a team against this meta
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        The PokeMCP team builder validates Champions and VGC teams, checks type
                        coverage against the threats above, and coaches you through the process.
                    </p>
                    <Link
                        href="/builder"
                        className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    >
                        Open the team builder
                    </Link>
                </section>
            </footer>
        </article>
    );
}
