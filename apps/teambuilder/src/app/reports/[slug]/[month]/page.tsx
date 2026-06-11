import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportShell } from "@/components/reports/ReportShell";
import { getAllReports, getReport } from "@/lib/reports";

export const dynamic = "force-static";
export const dynamicParams = false;

interface PageProps {
    params: Promise<{ slug: string; month: string }>;
}

export function generateStaticParams() {
    return getAllReports().map((report) => ({ slug: report.slug, month: report.month }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug, month } = await params;
    const report = getReport(slug, month);
    if (!report) return { title: "Report Not Found" };

    return {
        title: report.title,
        description: report.description,
        alternates: { canonical: `https://www.pokemcp.com/reports/${slug}/${month}` },
        openGraph: {
            title: report.title,
            description: report.description,
            type: "article",
            publishedTime: report.datePublished,
            modifiedTime: report.dateModified,
        },
    };
}

export default async function MonthlyReportPage({ params }: PageProps) {
    const { slug, month } = await params;
    const report = getReport(slug, month);
    if (!report) notFound();

    const { default: Body } = await import(`@/content/reports/${slug}/${month}.mdx`);

    return (
        <ReportShell report={report} canonicalPath={`/reports/${slug}/${month}`}>
            <Body />
        </ReportShell>
    );
}
