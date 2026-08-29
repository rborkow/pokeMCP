/**
 * pokemonitor — automated daily reporting for pokeMCP.
 *
 *  scheduled()  daily cron → generate + store + email yesterday's report
 *  fetch()      Access-protected dashboard + on-demand /run for testing
 */

import { validateAccessJwt } from "./auth";
import { getLatestHtml, getReportHtml, listReportDays } from "./deliver/store";
import { runDailyReport } from "./report/pipeline";
import { dayWindow } from "./util/dates";

export default {
    async scheduled(
        _controller: ScheduledController,
        env: Env,
        ctx: ExecutionContext,
    ): Promise<void> {
        const window = dayWindow(); // yesterday (UTC)
        ctx.waitUntil(
            runDailyReport(env, window)
                .then((r) =>
                    console.log(
                        `[cron] report ${r.day} done — emailed=${r.emailed} warnings=${r.warnings.length}`,
                    ),
                )
                .catch((err) => console.error("[cron] report failed:", err)),
        );
    },

    async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, "") || "/";

        try {
            if (path === "/run") return await handleRun(request, env, url);
            if (path === "/health") return json({ ok: true, env: env.ENVIRONMENT });

            // Everything else is the dashboard — Access-protected.
            const auth = await validateAccessJwt(request, env);
            if (!auth) return json({ error: "Unauthorized" }, 401);

            if (path === "/") return await handleIndex(env);
            if (path === "/latest") return serveHtml(await getLatestHtml(env));
            if (path.startsWith("/reports/")) {
                const day = path.slice("/reports/".length);
                return serveHtml(await getReportHtml(env, day));
            }
            return json({ error: "Not found", path }, 404);
        } catch (error) {
            console.error("[fetch] error:", error);
            return json({ error: "Internal error", detail: (error as Error).message }, 500);
        }
    },
} satisfies ExportedHandler<Env>;

/** On-demand generation. Dev: open. Prod: REPORT_RUN_TOKEN or a valid Access JWT. */
async function handleRun(request: Request, env: Env, url: URL): Promise<Response> {
    if (!(await authorizeRun(request, env, url))) {
        return json({ error: "Unauthorized" }, 401);
    }

    const day = url.searchParams.get("date") ?? undefined;
    const email = url.searchParams.get("email") === "1";
    const window = dayWindow(day);

    const result = await runDailyReport(env, window, { email });

    if (url.searchParams.get("format") === "json") {
        return json({
            day: result.day,
            emailed: result.emailed,
            deliveryDetail: result.deliveryDetail,
            warnings: result.warnings,
        });
    }
    return serveHtml(result.html);
}

async function authorizeRun(request: Request, env: Env, url: URL): Promise<boolean> {
    if (!env.CF_ACCESS_TEAM_DOMAIN && env.ENVIRONMENT !== "production") return true; // dev
    const token = url.searchParams.get("token") || request.headers.get("X-Run-Token");
    if (env.REPORT_RUN_TOKEN && token && token === env.REPORT_RUN_TOKEN) return true;
    return (await validateAccessJwt(request, env)) !== null;
}

async function handleIndex(env: Env): Promise<Response> {
    const days = await listReportDays(env);
    const items = days.length
        ? days.map((d) => `<li><a href="/reports/${d}">${d}</a></li>`).join("")
        : "<li>No reports yet.</li>";
    const body = `<!doctype html><html><head><meta charset="utf-8" />
      <title>pokemonitor</title>
      <style>body{font:15px/1.5 -apple-system,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;background:#0f1115;color:#e6e8ec}a{color:#6ea8fe}h1{font-size:20px}</style>
      </head><body><h1>pokeMCP daily reports</h1>
      <p><a href="/latest">→ Latest report</a></p>
      <ul>${items}</ul></body></html>`;
    return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function serveHtml(html: string | null): Response {
    if (!html) return json({ error: "Report not found" }, 404);
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
