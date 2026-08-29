/**
 * The end-to-end daily report pipeline:
 *   gather metrics → one Claude call → render HTML → store in R2 → email.
 */

import { sendReportEmail } from "../deliver/resend";
import { storeReport } from "../deliver/store";
import type { DateWindow, DailyMetrics, ReportNarrative } from "../types";
import { gatherDailyMetrics } from "./aggregate";
import { summarize } from "./claude";
import { renderReportHtml } from "./render";

export interface RunResult {
    day: string;
    html: string;
    emailed: boolean;
    deliveryDetail?: string;
    warnings: string[];
}

export async function runDailyReport(
    env: Env,
    window: DateWindow,
    options: { email: boolean } = { email: true },
): Promise<RunResult> {
    const metrics = await gatherDailyMetrics(env, window);

    // The report must still deliver metrics even if the Claude call fails
    // (e.g. Anthropic billing/quota, rate limit). Degrade to a narrative-less
    // report rather than failing the whole run.
    let narrative: ReportNarrative;
    try {
        narrative = await summarize(env, metrics);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[pipeline] summarize failed:", message);
        metrics.warnings.push(`summarize: ${message}`);
        narrative = {
            executive_summary:
                "Automated narrative unavailable — the Claude summarization call failed. Raw metrics follow.",
            notable_changes: [],
            query_interaction_insights: [],
            cost_commentary: "",
            anomalies: [`Claude summarization failed: ${message}`],
        };
    }

    const html = renderReportHtml(metrics, narrative);

    await storeReport(env, window.day, html, metrics, narrative);

    let emailed = false;
    let deliveryDetail: string | undefined;
    if (options.email) {
        const subject = `pokeMCP daily — ${window.day} · ${subjectUsage(metrics)}`;
        const result = await sendReportEmail(env, subject, html);
        emailed = result.ok;
        deliveryDetail = result.detail;
        if (!result.ok) console.error("[pipeline] email failed:", result.detail);
    }

    return { day: window.day, html, emailed, deliveryDetail, warnings: metrics.warnings };
}

/**
 * Subject-line usage figure. Gateway totals are the authoritative provider
 * spend; instrumented ai_chat cost is a clearly-labeled fallback; when neither
 * is available the subject says usage is unknown rather than implying $0.
 */
export function subjectUsage(metrics: DailyMetrics): string {
    if (metrics.gateway) {
        return `$${metrics.gateway.today.costUsd.toFixed(2)} AI (gateway)`;
    }
    if (metrics.claude) {
        return `$${metrics.claude.today.costUsd.toFixed(2)} AI (instrumented only)`;
    }
    return "AI usage unknown";
}
