import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportShell } from "@/components/reports/ReportShell";
import { getLatestReport, getReportFormats, getReportsBySlug } from "@/lib/reports";

export const dynamic = "force-static";
export const dynamicParams = false;

interface PageProps {
    params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
    return getReportFormats().map((format) => ({ slug: format.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const report = getLatestReport(slug);
    if (!report) return { title: "Report Not Found" };

    return {
        title: report.title,
        description: report.description,
        alternates: { canonical: `https://www.pokemcp.com/reports/${slug}` },
        openGraph: {
            title: report.title,
            description: report.description,
            type: "article",
            publishedTime: report.datePublished,
            modifiedTime: report.dateModified,
        },
    };
}

export default async function LatestReportPage({ params }: PageProps) {
    const { slug } = await params;
    const report = getLatestReport(slug);
    if (!report) notFound();

    const { default: Body } = await import(`@/content/reports/${slug}/${report.month}.mdx`);
    const archive = getReportsBySlug(slug).filter((entry) => entry.month !== report.month);

    return (
        <ReportShell report={report} canonicalPath={`/reports/${slug}`}>
            <Body />
            {archive.length > 0 && (
                <nav className="mt-10">
                    <h2 className="signal-mono mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                        Previous reports
                    </h2>
                    <ul className="space-y-1 text-sm">
                        {archive.map((entry) => (
                            <li key={entry.month}>
                                <Link
                                    href={`/reports/${slug}/${entry.month}`}
                                    className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                >
                                    {entry.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}
        </ReportShell>
    );
}
