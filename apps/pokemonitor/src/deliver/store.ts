/**
 * Persist generated reports to the REPORTS R2 bucket and read them back for the
 * dashboard. Layout:
 *   reports/YYYY-MM-DD.html   rendered report
 *   reports/YYYY-MM-DD.json   raw { metrics, narrative } for trend/debug
 *   reports/latest.html       pointer to the most recent rendered report
 */

import type { DailyMetrics, ReportNarrative } from "../types";

export async function storeReport(
    env: Env,
    day: string,
    html: string,
    metrics: DailyMetrics,
    narrative: ReportNarrative,
): Promise<void> {
    await Promise.all([
        env.REPORTS.put(`reports/${day}.html`, html, {
            httpMetadata: { contentType: "text/html; charset=utf-8" },
        }),
        env.REPORTS.put(`reports/${day}.json`, JSON.stringify({ metrics, narrative }, null, 2), {
            httpMetadata: { contentType: "application/json" },
        }),
        env.REPORTS.put("reports/latest.html", html, {
            httpMetadata: { contentType: "text/html; charset=utf-8" },
        }),
    ]);
}

export async function getReportHtml(env: Env, day: string): Promise<string | null> {
    const obj = await env.REPORTS.get(`reports/${day}.html`);
    return obj ? await obj.text() : null;
}

export async function getLatestHtml(env: Env): Promise<string | null> {
    const obj = await env.REPORTS.get("reports/latest.html");
    return obj ? await obj.text() : null;
}

export async function listReportDays(env: Env, limit = 60): Promise<string[]> {
    const page = await env.REPORTS.list({ prefix: "reports/", limit: 1000 });
    return page.objects
        .map((o) => o.key)
        .filter((k) => k.endsWith(".html") && !k.endsWith("latest.html"))
        .map((k) => k.slice("reports/".length, -".html".length))
        .sort()
        .reverse()
        .slice(0, limit);
}
