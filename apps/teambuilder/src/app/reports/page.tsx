import type { Metadata } from "next";
import Link from "next/link";
import { formatMonthLong, getReportFormats, getReportsBySlug } from "@/lib/reports";

export const dynamic = "force-static";

export const metadata: Metadata = {
    title: "Competitive Pokémon Meta Reports",
    description:
        "Monthly meta reports for Pokémon Champions VGC and competitive Pokémon formats: usage statistics, month-over-month trends, risers and fallers, written analysis grounded in Smogon ladder data.",
    alternates: { canonical: "https://www.pokemcp.com/reports" },
    openGraph: {
        title: "Competitive Pokémon Meta Reports | PokeMCP",
        description:
            "Monthly meta reports for Pokémon Champions VGC and competitive Pokémon formats, grounded in Smogon usage data.",
    },
};

export default function ReportsIndexPage() {
    const formats = getReportFormats();

    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10">
            <header className="mb-8 border-b border-border pb-6">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                    Competitive Pokémon Meta Reports
                </h1>
                <p className="mt-3 leading-7 text-muted-foreground">
                    Written monthly analysis of the Pokémon Champions and VGC metagames, generated
                    from Smogon usage statistics and reviewed by a human before publishing. Every
                    number in a report appears in a plain table and traces to the raw Smogon data
                    file linked at the bottom of the page.
                </p>
            </header>
            <div className="space-y-10">
                {formats.map((format) => {
                    const reports = getReportsBySlug(format.slug);
                    const [latest, ...archive] = reports;
                    return (
                        <section key={format.slug}>
                            <h2 className="text-xl font-semibold text-foreground">{format.name}</h2>
                            <ul className="mt-3 space-y-2">
                                <li>
                                    <Link
                                        href={`/reports/${format.slug}`}
                                        className="text-foreground underline underline-offset-4"
                                    >
                                        {latest.title}
                                    </Link>
                                    <span className="ml-2 text-sm text-muted-foreground">
                                        (latest — data through {formatMonthLong(latest.dataThrough)}
                                        )
                                    </span>
                                </li>
                                {archive.map((report) => (
                                    <li key={report.month}>
                                        <Link
                                            href={`/reports/${format.slug}/${report.month}`}
                                            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                        >
                                            {report.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
            </div>
        </main>
    );
}
