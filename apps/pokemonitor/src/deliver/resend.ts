/**
 * Email delivery via Resend (https://resend.com).
 *
 * Resend reaches an arbitrary inbox (e.g. Gmail) with just an API key, avoiding
 * the Cloudflare Email Routing constraint that SEND_EMAIL can only target
 * pre-verified destination addresses. The sender domain must be verified in
 * Resend; REPORT_EMAIL_FROM should be on that domain (e.g. @pokemcp.com).
 */

export async function sendReportEmail(
    env: Env,
    subject: string,
    html: string,
): Promise<{ ok: boolean; detail?: string }> {
    if (!env.RESEND_API_KEY) {
        return { ok: false, detail: "RESEND_API_KEY not set — skipping email" };
    }

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: env.REPORT_EMAIL_FROM,
            to: env.REPORT_EMAIL_TO,
            subject,
            html,
        }),
    });

    if (!res.ok) {
        return { ok: false, detail: `Resend HTTP ${res.status}: ${await res.text()}` };
    }
    return { ok: true };
}
