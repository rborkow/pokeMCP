import manifest from "@/content/reports/manifest.json";

/**
 * One published meta report. Entries live in src/content/reports/manifest.json,
 * which is maintained by scripts/generate-reports.ts (repo root) — the monthly
 * stats workflow regenerates it alongside the MDX content. Hand-edit only for
 * one-off reports (e.g. the launch retrospective).
 */
export interface ReportSource {
    label: string;
    url: string;
}

export interface ReportEntry {
    /** URL segment for the format, stable across regulation rotations: "champions", "vgc", "ou". */
    slug: string;
    /** Report month, YYYY-MM. Forms the permanent URL /reports/{slug}/{month}. */
    month: string;
    title: string;
    description: string;
    datePublished: string;
    dateModified: string;
    /** Last month of Smogon data the report covers (YYYY-MM). */
    dataThrough: string;
    /** Internal format id the data was pulled for (e.g. "champions-regma"). */
    formatId: string;
    /** Human-readable format + regulation name shown in the byline. */
    formatName: string;
    sources: ReportSource[];
}

export interface ReportFormatInfo {
    slug: string;
    /** Display name for the format series (not regulation-specific). */
    name: string;
}

const REPORT_FORMATS: ReportFormatInfo[] = [
    { slug: "champions", name: "Pokémon Champions VGC" },
    { slug: "vgc", name: "VGC (Scarlet/Violet)" },
    { slug: "ou", name: "Smogon OU (Singles)" },
];

const byMonthDesc = (a: ReportEntry, b: ReportEntry) => b.month.localeCompare(a.month);

export function getAllReports(): ReportEntry[] {
    return (manifest as ReportEntry[]).slice().sort(byMonthDesc);
}

export function getReportFormats(): ReportFormatInfo[] {
    const slugsWithReports = new Set(getAllReports().map((r) => r.slug));
    return REPORT_FORMATS.filter((f) => slugsWithReports.has(f.slug));
}

export function getReportsBySlug(slug: string): ReportEntry[] {
    return getAllReports().filter((r) => r.slug === slug);
}

export function getLatestReport(slug: string): ReportEntry | undefined {
    return getReportsBySlug(slug)[0];
}

export function getReport(slug: string, month: string): ReportEntry | undefined {
    return getAllReports().find((r) => r.slug === slug && r.month === month);
}

export function formatMonthLong(month: string): string {
    const [year, m] = month.split("-").map(Number);
    return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });
}
