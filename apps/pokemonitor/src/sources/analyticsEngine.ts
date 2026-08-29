/**
 * Cloudflare Analytics Engine source.
 *
 * Reads the `pokemcp-analytics` dataset written by pokeMCP (src/analytics.ts)
 * via the SQL HTTP API. The query bodies are ported from pokeMCP `src/admin.ts`
 * (handleOverview / handleCosts / handleTools) but pinned to an explicit UTC day
 * window instead of a rolling NOW() - INTERVAL.
 *
 * Slot mapping (see pokeMCP src/analytics.ts):
 *   ai_chat   blob1 format, blob2 personality, blob3 mode, blob4 thinking, blob5 source
 *             double1 input, double2 output, double3 cacheCreate, double4 cacheRead,
 *             double5 teamSize, double6 responseMs, double7 costUsd
 *   tool_call blob1 tool, blob2 format, blob3 success, blob4 sessionId, blob5 source
 *             double1 responseMs
 *   session   blob1 action, blob2 sessionId, blob3 transport, blob4 source
 *
 * Sampling: Analytics Engine answers queries with Adaptive Bit Rate sampling —
 * the same window can be served at different sample intervals per query, so raw
 * count()/sum() silently undercount (observed: a totals query returning 2 of 17
 * rows while the breakdown queries saw all 17). Every aggregate below must be
 * weighted by _sample_interval: count() → sum(_sample_interval),
 * sum(x) → sum(x * _sample_interval), avg(x) → sum(x * _sample_interval) / sum(_sample_interval).
 */

import type {
    AiChatTotals,
    BreakdownRow,
    ClaudeAnalytics,
    DailyTrendRow,
    DateWindow,
    QueryAnalytics,
    ToolStatRow,
} from "../types";
import { sqlDateTime, trendStartIso } from "../util/dates";

interface AnalyticsQueryResult {
    data: Record<string, unknown>[];
    rows: number;
}

async function querySql(env: Env, sql: string, retries = 3): Promise<AnalyticsQueryResult> {
    if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
        throw new Error("Analytics Engine credentials not configured");
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
                    "Content-Type": "text/plain",
                },
                body: sql,
            },
        );

        if (response.status === 429 && attempt < retries) {
            const delay = 500 * 2 ** attempt;
            console.warn(`[AE] rate limited, retrying in ${delay}ms`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
        }

        if (!response.ok) {
            const errorText = await response.text();
            // 422 typically means the table has no rows yet for the window.
            if (response.status === 422) {
                console.warn("[AE] 422 (no data):", errorText);
                return { data: [], rows: 0 };
            }
            throw new Error(`Analytics Engine query failed: ${response.status} ${errorText}`);
        }

        return (await response.json()) as AnalyticsQueryResult;
    }

    throw new Error("Analytics Engine query failed: max retries exceeded");
}

function num(row: Record<string, unknown> | undefined, key: string): number {
    const v = row?.[key];
    return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

function table(env: Env): string {
    return `"${env.ANALYTICS_DATASET}"`;
}

function windowClause(window: DateWindow): string {
    // Analytics Engine SQL needs toDateTime() coercion — a bare string literal
    // compared against the timestamp column matches nothing.
    return `timestamp >= toDateTime('${sqlDateTime(window.startIso)}') AND timestamp < toDateTime('${sqlDateTime(window.endIso)}')`;
}

// --- Claude API analytics (priority) ---

export async function getClaudeAnalytics(env: Env, window: DateWindow): Promise<ClaudeAnalytics> {
    const t = table(env);
    const where = windowClause(window);

    const totalsRes = await querySql(
        env,
        `SELECT
            sum(_sample_interval) as requests,
            sum(double1 * _sample_interval) as input_tokens,
            sum(double2 * _sample_interval) as output_tokens,
            sum(double3 * _sample_interval) as cache_creation_tokens,
            sum(double4 * _sample_interval) as cache_read_tokens,
            sum(double7 * _sample_interval) as cost_usd,
            sum(double6 * _sample_interval) / sum(_sample_interval) as avg_response_ms
        FROM ${t}
        WHERE index1 = 'ai_chat' AND ${where}`,
    );

    const byFormatRes = await querySql(
        env,
        `SELECT blob1 as key, sum(_sample_interval) as requests, sum(double7 * _sample_interval) as cost_usd,
            sum(double1 * _sample_interval) as input_tokens, sum(double2 * _sample_interval) as output_tokens
        FROM ${t}
        WHERE index1 = 'ai_chat' AND ${where}
        GROUP BY key ORDER BY cost_usd DESC`,
    );

    const byPersonalityRes = await querySql(
        env,
        `SELECT blob2 as key, sum(_sample_interval) as requests, sum(double7 * _sample_interval) as cost_usd
        FROM ${t}
        WHERE index1 = 'ai_chat' AND ${where}
        GROUP BY key ORDER BY requests DESC`,
    );

    const bySourceRes = await querySql(
        env,
        `SELECT blob5 as key, sum(_sample_interval) as requests, sum(double7 * _sample_interval) as cost_usd
        FROM ${t}
        WHERE index1 = 'ai_chat' AND ${where}
        GROUP BY key ORDER BY requests DESC`,
    );

    const trendRes = await querySql(
        env,
        `SELECT toStartOfDay(timestamp) as day, sum(_sample_interval) as requests,
            sum(double7 * _sample_interval) as cost_usd, sum(double1 * _sample_interval) as input_tokens,
            sum(double2 * _sample_interval) as output_tokens, sum(double4 * _sample_interval) as cache_read_tokens
        FROM ${t}
        WHERE index1 = 'ai_chat'
            AND timestamp >= toDateTime('${sqlDateTime(trendStartIso(window, 7))}')
            AND timestamp < toDateTime('${sqlDateTime(window.endIso)}')
        GROUP BY day ORDER BY day ASC`,
    );

    // Staleness signal: the most recent ai_chat datapoint anywhere in the
    // dataset. When product instrumentation silently stops (e.g. a new route
    // that forgets trackAIChat), the windowed totals collapse to zero while
    // usage continues — this timestamp lets the report say "stale" instead.
    // MAX timestamp queries are tiny and not meaningfully affected by ABR
    // sampling for this purpose.
    const lastEventRes = await querySql(
        env,
        `SELECT toString(max(timestamp)) as last_event_at FROM ${t} WHERE index1 = 'ai_chat'`,
    );
    const rawLast = lastEventRes.data[0]?.last_event_at;
    const lastEventAtIso =
        typeof rawLast === "string" && rawLast && !rawLast.startsWith("1970-01-01")
            ? rawLast.replace(" ", "T") + (rawLast.endsWith("Z") ? "" : "Z")
            : null;

    const totals = totalsRes.data[0];
    const input = num(totals, "input_tokens");
    const cacheRead = num(totals, "cache_read_tokens");
    const today: AiChatTotals = {
        requests: num(totals, "requests"),
        inputTokens: input,
        outputTokens: num(totals, "output_tokens"),
        cacheCreationTokens: num(totals, "cache_creation_tokens"),
        cacheReadTokens: cacheRead,
        costUsd: num(totals, "cost_usd"),
        avgResponseMs: totals?.avg_response_ms != null ? num(totals, "avg_response_ms") : null,
        cacheHitRate: input + cacheRead > 0 ? cacheRead / (input + cacheRead) : 0,
    };

    const toBreakdown = (rows: Record<string, unknown>[]): BreakdownRow[] =>
        rows.map((r) => ({
            key: String(r.key ?? "(none)") || "(none)",
            requests: num(r, "requests"),
            costUsd: r.cost_usd != null ? num(r, "cost_usd") : undefined,
            inputTokens: r.input_tokens != null ? num(r, "input_tokens") : undefined,
            outputTokens: r.output_tokens != null ? num(r, "output_tokens") : undefined,
        }));

    const dailyTrend: DailyTrendRow[] = trendRes.data.map((r) => ({
        day: String(r.day ?? "").slice(0, 10),
        requests: num(r, "requests"),
        costUsd: num(r, "cost_usd"),
        inputTokens: num(r, "input_tokens"),
        outputTokens: num(r, "output_tokens"),
        cacheReadTokens: num(r, "cache_read_tokens"),
    }));

    return {
        today,
        byFormat: toBreakdown(byFormatRes.data),
        byPersonality: toBreakdown(byPersonalityRes.data),
        bySource: toBreakdown(bySourceRes.data),
        dailyTrend,
        lastEventAtIso,
    };
}

// --- Query types & interactions (structured half; R2 digest added separately) ---

export async function getToolAnalytics(
    env: Env,
    window: DateWindow,
): Promise<Pick<QueryAnalytics, "toolStats" | "toolBySource" | "sessions">> {
    const t = table(env);
    const where = windowClause(window);

    const toolsRes = await querySql(
        env,
        `SELECT blob1 as tool, sum(_sample_interval) as calls,
            sum(if(blob3 = '1', _sample_interval, 0)) as successes,
            sum(double1 * _sample_interval) / sum(_sample_interval) as avg_response_ms
        FROM ${t}
        WHERE index1 = 'tool_call' AND ${where}
        GROUP BY tool ORDER BY calls DESC`,
    );

    const bySourceRes = await querySql(
        env,
        `SELECT blob5 as key, sum(_sample_interval) as requests
        FROM ${t}
        WHERE index1 = 'tool_call' AND ${where}
        GROUP BY key ORDER BY requests DESC`,
    );

    const sessionRes = await querySql(
        env,
        `SELECT sum(_sample_interval) as events,
            sum(if(blob1 = 'connect', _sample_interval, 0)) as connections,
            sum(if(blob1 = 'disconnect', _sample_interval, 0)) as disconnections
        FROM ${t}
        WHERE index1 = 'session' AND ${where}`,
    );

    const toolStats: ToolStatRow[] = toolsRes.data.map((r) => ({
        tool: String(r.tool ?? "(unknown)") || "(unknown)",
        calls: num(r, "calls"),
        successes: num(r, "successes"),
        avgResponseMs: r.avg_response_ms != null ? num(r, "avg_response_ms") : null,
    }));

    const toolBySource: BreakdownRow[] = bySourceRes.data.map((r) => ({
        key: String(r.key ?? "(none)") || "(none)",
        requests: num(r, "requests"),
    }));

    const s = sessionRes.data[0];
    const sessions = s
        ? {
              events: num(s, "events"),
              connections: num(s, "connections"),
              disconnections: num(s, "disconnections"),
          }
        : null;

    return { toolStats, toolBySource, sessions };
}

/** Lightweight connectivity/diagnostic check (mirrors admin.ts handleDiagnostics). */
export async function analyticsEngineHealthy(env: Env): Promise<boolean> {
    try {
        await querySql(
            env,
            `SELECT count() as total FROM ${table(env)} WHERE timestamp > NOW() - INTERVAL '1' HOUR`,
            0,
        );
        return true;
    } catch (error) {
        console.error("[AE] health check failed:", error);
        return false;
    }
}
