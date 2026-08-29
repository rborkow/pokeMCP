/**
 * Render a DailyMetrics snapshot + Claude narrative into a self-contained HTML
 * report. The same HTML is used as the email body and served by the dashboard.
 */

import type {
    BreakdownRow,
    DailyMetrics,
    DailyTrendRow,
    ReportNarrative,
    VisitorAnalytics,
} from "../types";

export function renderReportHtml(metrics: DailyMetrics, narrative: ReportNarrative): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>pokeMCP daily report — ${esc(metrics.window.day)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         margin: 0; padding: 24px; background: #0f1115; color: #e6e8ec; }
  .wrap { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .06em; color: #8b93a7;
       margin: 28px 0 10px; border-bottom: 1px solid #232733; padding-bottom: 6px; }
  .sub { color: #8b93a7; font-size: 13px; margin: 0 0 8px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; }
  .card { background: #171a21; border: 1px solid #232733; border-radius: 10px; padding: 12px 14px; min-width: 130px; }
  .card .n { font-size: 20px; font-weight: 600; }
  .card .l { font-size: 12px; color: #8b93a7; }
  ul { margin: 6px 0; padding-left: 18px; }
  li { margin: 3px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 6px 0; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #232733; }
  th { color: #8b93a7; font-weight: 600; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .summary { background: #171a21; border: 1px solid #232733; border-radius: 10px; padding: 14px 16px; }
  .warn { color: #d98c3a; font-size: 12px; }
  .anom li { color: #e0b15a; }
  footer { margin-top: 28px; color: #5d667c; font-size: 12px; }
  a { color: #6ea8fe; }
</style>
</head>
<body><div class="wrap">
  <h1>pokeMCP daily report</h1>
  <p class="sub">${esc(metrics.window.day)} (UTC) · generated ${esc(metrics.generatedAtIso)}</p>

  <div class="summary">
    <p style="margin:0">${esc(narrative.executive_summary)}</p>
  </div>

  ${list("Notable changes", narrative.notable_changes)}
  ${list("Query &amp; interaction insights", narrative.query_interaction_insights)}
  ${narrative.cost_commentary ? `<h2>Cost commentary</h2><p>${esc(narrative.cost_commentary)}</p>` : ""}
  ${narrative.anomalies.length ? `<h2>Anomalies</h2><ul class="anom">${narrative.anomalies.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}

  ${renderGateway(metrics)}
  ${renderClaude(metrics)}
  ${renderQueries(metrics)}
  ${renderCompute(metrics)}
  ${renderVisitors(metrics.visitors)}

  ${metrics.warnings.length ? `<h2>Warnings</h2><ul>${metrics.warnings.map((w) => `<li class="warn">${esc(w)}</li>`).join("")}</ul>` : ""}
  <footer>pokemonitor · automated daily report</footer>
</div></body></html>`;
}

/**
 * Provider-side usage from AI Gateway logs — the PRIMARY spend figure. Never
 * renders "$0"; when unavailable it says so and points at the permission fix.
 */
function renderGateway(m: DailyMetrics): string {
    if (!m.gateway) {
        return `<h2>Provider AI usage (AI Gateway)</h2><p class="warn">⚠ Provider-side usage unavailable — the AI Gateway logs source failed (see Warnings). Total Anthropic spend for this day is UNKNOWN; the instrumented figures below are a lower bound at best.</p>`;
    }
    const g = m.gateway;
    const t = g.today;
    const failRate = t.requests ? `${((t.failures / t.requests) * 100).toFixed(1)}%` : "—";
    return `<h2>Provider AI usage (AI Gateway “${esc(g.gatewayId)}”)</h2>
    <p class="sub">Actual provider-side requests through the gateway — the authoritative spend figure.</p>
    <div class="cards">
      ${card(fmtInt(t.requests), "requests")}
      ${card(`$${t.costUsd.toFixed(4)}`, "cost (gateway)")}
      ${card(fmtInt(t.tokensIn), "tokens in")}
      ${card(fmtInt(t.tokensOut), "tokens out")}
      ${card(fmtInt(t.failures), `failures (${failRate})`)}
      ${card(fmtInt(t.cachedRequests), "cached")}
      ${card(t.avgDurationMs != null ? `${Math.round(t.avgDurationMs)}ms` : "—", "avg duration")}
    </div>
    ${gatewayTable("By provider", g.byProvider)}
    ${gatewayTable("By model", g.byModel)}
    ${gatewayTable("By source", g.bySource)}
    ${gatewayTrendTable(g.dailyTrend)}`;
}

function gatewayTable(title: string, rows: import("../types").GatewayBreakdownRow[]): string {
    if (!rows.length) return "";
    return `<table><thead><tr><th>${esc(title)}</th><th class="num">Requests</th><th class="num">Failures</th><th class="num">Tok in</th><th class="num">Tok out</th><th class="num">Cost</th></tr></thead><tbody>${rows
        .map(
            (r) =>
                `<tr><td>${esc(r.key)}</td><td class="num">${fmtInt(r.requests)}</td><td class="num">${fmtInt(r.failures)}</td><td class="num">${fmtInt(r.tokensIn)}</td><td class="num">${fmtInt(r.tokensOut)}</td><td class="num">$${r.costUsd.toFixed(4)}</td></tr>`,
        )
        .join("")}</tbody></table>`;
}

function gatewayTrendTable(rows: import("../types").GatewayDailyRow[]): string {
    if (rows.length < 2) return "";
    return `<p class="sub">7-day trend (gateway)</p><table><thead><tr><th>Day</th><th class="num">Requests</th><th class="num">Failures</th><th class="num">Tok in</th><th class="num">Tok out</th><th class="num">Cost</th></tr></thead><tbody>${rows
        .map(
            (r) =>
                `<tr><td>${esc(r.day)}</td><td class="num">${fmtInt(r.requests)}</td><td class="num">${fmtInt(r.failures)}</td><td class="num">${fmtInt(r.tokensIn)}</td><td class="num">${fmtInt(r.tokensOut)}</td><td class="num">$${r.costUsd.toFixed(4)}</td></tr>`,
        )
        .join("")}</tbody></table>`;
}

function renderClaude(m: DailyMetrics): string {
    if (!m.claude) {
        return `<h2>Instrumented product AI usage</h2><p class="warn">⚠ Instrumented telemetry unavailable — this is NOT confirmation of $0 usage.</p>`;
    }
    const t = m.claude.today;
    const scope = m.gateway
        ? "Web app routes that emit ai_chat telemetry (secondary metric; provider totals above)."
        : "Web app routes that emit ai_chat telemetry only — NOT total Anthropic usage.";
    const staleNote =
        m.claude.lastEventAtIso != null && m.claude.lastEventAtIso < m.window.startIso
            ? `<p class="warn">⚠ Telemetry is stale — last ai_chat event: ${esc(m.claude.lastEventAtIso)}. Figures may reflect older traffic or missing instrumentation, not a true zero.</p>`
            : "";
    return `<h2>Instrumented product AI usage</h2>
    <p class="sub">${scope} Last telemetry event: ${esc(m.claude.lastEventAtIso ?? "never")}.</p>
    ${staleNote}
    <div class="cards">
      ${card(fmtInt(t.requests), "requests")}
      ${card(`$${t.costUsd.toFixed(2)}`, "cost (est.)")}
      ${card(fmtInt(t.inputTokens), "input tokens")}
      ${card(fmtInt(t.outputTokens), "output tokens")}
      ${card(`${(t.cacheHitRate * 100).toFixed(0)}%`, "cache hit rate")}
      ${card(t.avgResponseMs != null ? `${Math.round(t.avgResponseMs)}ms` : "—", "avg latency")}
    </div>
    ${breakdownTable("By source", m.claude.bySource)}
    ${breakdownTable("By format", m.claude.byFormat)}
    ${breakdownTable("By personality", m.claude.byPersonality)}
    ${trendTable(m.claude.dailyTrend)}`;
}

function trendTable(rows: DailyTrendRow[]): string {
    if (rows.length < 2) return "";
    return `<p class="sub">7-day trend</p><table><thead><tr><th>Day</th><th class="num">Requests</th><th class="num">Cost</th><th class="num">Input</th><th class="num">Output</th><th class="num">Cache read</th></tr></thead><tbody>${rows
        .map(
            (r) =>
                `<tr><td>${esc(r.day)}</td><td class="num">${fmtInt(r.requests)}</td><td class="num">$${r.costUsd.toFixed(2)}</td><td class="num">${fmtInt(r.inputTokens)}</td><td class="num">${fmtInt(r.outputTokens)}</td><td class="num">${fmtInt(r.cacheReadTokens)}</td></tr>`,
        )
        .join("")}</tbody></table>`;
}

function renderQueries(m: DailyMetrics): string {
    if (!m.queries) return `<h2>Query types &amp; interactions</h2><p class="sub">No data.</p>`;
    const q = m.queries;
    const tools = q.toolStats.length
        ? `<table><thead><tr><th>Tool</th><th class="num">Calls</th><th class="num">Success</th><th class="num">Avg ms</th></tr></thead><tbody>${q.toolStats
              .map(
                  (r) =>
                      `<tr><td>${esc(r.tool)}</td><td class="num">${fmtInt(r.calls)}</td><td class="num">${r.calls ? Math.round((r.successes / r.calls) * 100) : 0}%</td><td class="num">${r.avgResponseMs != null ? Math.round(r.avgResponseMs) : "—"}</td></tr>`,
              )
              .join("")}</tbody></table>`
        : `<p class="sub">No tool calls recorded.</p>`;

    const sampled = q.sampled;
    const sampledHtml = sampled
        ? `<p class="sub">Sampled interactions (10%): ${fmtInt(sampled.sampleSize)} logged</p>
           ${twoCol(
               miniList(
                   "Top Pokémon",
                   sampled.topPokemon.map((p) => `${esc(p.name)} (${p.count})`),
               ),
               miniList(
                   "Top formats",
                   sampled.topFormats.map((f) => `${esc(f.format)} (${f.count})`),
               ),
           )}`
        : `<p class="sub">No sampled interaction logs for this day.</p>`;

    return `<h2>Query types &amp; interactions</h2>${tools}${sampledHtml}`;
}

function renderCompute(m: DailyMetrics): string {
    if (!m.compute) return `<h2>Compute &amp; storage</h2><p class="sub">No data.</p>`;
    const c = m.compute;
    const workers = c.workers.length
        ? `<table><thead><tr><th>Worker</th><th class="num">Requests</th><th class="num">Errors</th><th class="num">Subreq</th><th class="num">CPU p50</th><th class="num">CPU p99</th></tr></thead><tbody>${c.workers
              .map(
                  (w) =>
                      `<tr><td>${esc(w.script)}</td><td class="num">${fmtInt(w.requests)}</td><td class="num">${fmtInt(w.errors)}</td><td class="num">${fmtInt(w.subrequests)}</td><td class="num">${w.cpuTimeP50Us != null ? `${w.cpuTimeP50Us}µs` : "—"}</td><td class="num">${w.cpuTimeP99Us != null ? `${w.cpuTimeP99Us}µs` : "—"}</td></tr>`,
              )
              .join("")}</tbody></table>`
        : `<p class="sub">No Worker compute data.</p>`;

    const storage = c.storage.r2
        ? `<div class="cards">${card(fmtInt(c.storage.r2.objects ?? 0), "R2 objects")}${card(fmtBytes(c.storage.r2.bytes), "R2 stored")}</div>`
        : `<p class="sub">No storage data.</p>`;

    return `<h2>Compute &amp; storage</h2>${workers}${storage}`;
}

function renderVisitors(v: VisitorAnalytics | null): string {
    if (!v?.enabled) {
        return `<h2>Visitors</h2><p class="sub">Web Analytics not enabled — set CF_ANALYTICS_SITE_TAG and the teambuilder beacon token.</p>`;
    }
    return `<h2>Visitors</h2>
      <div class="cards">${card(fmtInt(v.visits ?? 0), "visits")}${card(fmtInt(v.pageViews ?? 0), "page views")}</div>
      ${twoCol(
          miniList(
              "Top pages",
              v.topPages.map((p) => `${esc(p.path)} (${p.views})`),
          ),
          miniList(
              "Top countries",
              v.topCountries.map((c) => `${esc(c.country)} (${c.visits})`),
          ),
      )}
      ${miniList(
          "Top referrers",
          v.topReferrers.map((r) => `${esc(r.referrer || "(direct)")} (${r.visits})`),
      )}`;
}

// --- small helpers ---

function card(n: string, l: string): string {
    return `<div class="card"><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`;
}

function list(title: string, items: string[]): string {
    if (!items.length) return "";
    return `<h2>${title}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function miniList(title: string, items: string[]): string {
    if (!items.length) return `<div><strong>${title}</strong><p class="sub">—</p></div>`;
    return `<div><strong>${title}</strong><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul></div>`;
}

function twoCol(a: string, b: string): string {
    return `<div style="display:flex;gap:24px;flex-wrap:wrap">${a}${b}</div>`;
}

function breakdownTable(title: string, rows: BreakdownRow[]): string {
    if (!rows.length) return "";
    const hasCost = rows.some((r) => r.costUsd != null);
    return `<table><thead><tr><th>${esc(title)}</th><th class="num">Requests</th>${hasCost ? '<th class="num">Cost</th>' : ""}</tr></thead><tbody>${rows
        .map(
            (r) =>
                `<tr><td>${esc(r.key)}</td><td class="num">${fmtInt(r.requests)}</td>${hasCost ? `<td class="num">$${(r.costUsd ?? 0).toFixed(2)}</td>` : ""}</tr>`,
        )
        .join("")}</tbody></table>`;
}

function fmtInt(n: number): string {
    return Math.round(n).toLocaleString("en-US");
}

function fmtBytes(n: number | null): string {
    if (n == null) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${v.toFixed(1)} ${units[i]}`;
}

function esc(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
        c === "&"
            ? "&amp;"
            : c === "<"
              ? "&lt;"
              : c === ">"
                ? "&gt;"
                : c === '"'
                  ? "&quot;"
                  : "&#39;",
    );
}
