import Link from "next/link";
import { formatMonthLong, getAllReports } from "@/lib/reports";

/**
 * Landing-page section surfacing the newest meta report (server component —
 * manifest is read at build time, so this updates whenever a report ships).
 * Champions is the flagship: prefer it when multiple formats share the
 * newest month.
 */
export function LatestReportSection() {
    const reports = getAllReports();
    if (reports.length === 0) return null;
    const newestMonth = reports[0].month;
    const latest =
        reports.find((report) => report.month === newestMonth && report.slug === "champions") ??
        reports[0];

    return (
        <section className="mx-6 md:mx-10 py-10 border-t border-border">
            <p className="signal-mono mb-3 text-xs uppercase tracking-wide text-muted-foreground">
                Monthly Meta Report
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
                <Link href={`/reports/${latest.slug}`} className="hover:underline">
                    {latest.title}
                </Link>
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {latest.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                <Link
                    href={`/reports/${latest.slug}`}
                    className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
                >
                    Read the report
                </Link>
                <Link
                    href="/reports"
                    className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                    All meta reports
                </Link>
                <span className="text-xs text-muted-foreground">
                    Data through {formatMonthLong(latest.dataThrough)} · refreshed monthly
                </span>
            </div>
        </section>
    );
}
