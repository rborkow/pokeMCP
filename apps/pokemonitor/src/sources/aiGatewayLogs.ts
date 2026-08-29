/**
 * Cloudflare AI Gateway logs source — provider-side ground truth for Anthropic
 * (and any other provider) spend routed through the `pokemcp` gateway.
 *
 * Uses the REST endpoint:
 *   GET /accounts/{account_id}/ai-gateway/gateways/{gateway_id}/logs
 * which returns per-request entries with provider, model, tokens_in,
 * tokens_out, cost, success, cached, duration, status_code, metadata, and
 * created_at, paginated via `page`/`per_page` + `result_info.total_count`.
 *
 * Required token permission: "AI Gateway Read" (AI Gateway Write also works).
 * When the token lacks it the API returns 403 — that must surface as an
 * unavailable/warning state, NEVER as zero usage.
 *
 * Only aggregate fields are consumed here; request/response payloads are never
 * fetched or logged.
 */

import type { DateWindow, GatewayAnalytics, GatewayBreakdownRow, GatewayDailyRow } from "../types";
import { trendStartIso } from "../util/dates";

const PER_PAGE = 100;
const MAX_PAGES = 50; // hard cap: 5,000 log entries per window

export class GatewayLogsError extends Error {
    constructor(
        message: string,
        readonly status?: number,
    ) {
        super(message);
        this.name = "GatewayLogsError";
    }
}

interface GatewayLogEntry {
    id: string;
    created_at: string;
    provider: string | null;
    model: string | null;
    success: boolean;
    cached: boolean;
    tokens_in: number | null;
    tokens_out: number | null;
    cost: number | null;
    duration: number | null;
    status_code: number | null;
    metadata?: unknown;
}

interface GatewayLogsPage {
    result: GatewayLogEntry[];
    result_info?: { total_count?: number; count?: number; page?: number; per_page?: number };
    success: boolean;
    errors?: Array<{ message?: string }>;
}

type FetchImpl = typeof fetch;

function num(v: unknown): number {
    return typeof v === "number" && Number.isFinite(v) ? v : Number(v ?? 0) || 0;
}

/** Parse cf-aig-metadata, which may arrive as a JSON string or an object. */
export function parseLogSource(metadata: unknown): string {
    if (!metadata) return "(none)";
    let obj: unknown = metadata;
    if (typeof metadata === "string") {
        try {
            obj = JSON.parse(metadata);
        } catch {
            return "(none)";
        }
    }
    if (obj && typeof obj === "object") {
        const source = (obj as Record<string, unknown>).source;
        if (typeof source === "string" && source) return source;
    }
    return "(none)";
}

async function fetchLogsPage(
    env: Env,
    opts: { startIso: string; endIso: string; page: number },
    fetchImpl: FetchImpl,
): Promise<GatewayLogsPage> {
    if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
        throw new GatewayLogsError("Cloudflare API credentials not configured");
    }
    if (!env.AI_GATEWAY_ID) {
        throw new GatewayLogsError("AI_GATEWAY_ID not configured");
    }

    const filters = [
        { key: "created_at", operator: "gte", value: opts.startIso },
        { key: "created_at", operator: "lt", value: opts.endIso },
    ];
    const url = new URL(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai-gateway/gateways/${env.AI_GATEWAY_ID}/logs`,
    );
    url.searchParams.set("page", String(opts.page));
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("direction", "asc");
    url.searchParams.set("filters", JSON.stringify(filters));

    const response = await fetchImpl(url.toString(), {
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    });

    if (response.status === 401 || response.status === 403) {
        throw new GatewayLogsError(
            `AI Gateway logs API returned ${response.status} — the CLOUDFLARE_API_TOKEN is missing the "AI Gateway Read" permission (see README)`,
            response.status,
        );
    }
    if (!response.ok) {
        const text = await response.text();
        throw new GatewayLogsError(
            `AI Gateway logs API failed: ${response.status} ${text.slice(0, 200)}`,
            response.status,
        );
    }

    const body = (await response.json()) as GatewayLogsPage;
    if (!body.success) {
        const msg = body.errors?.map((e) => e.message).join("; ") || "unknown error";
        throw new GatewayLogsError(`AI Gateway logs API error: ${msg}`);
    }
    return body;
}

async function fetchAllLogs(
    env: Env,
    startIso: string,
    endIso: string,
    fetchImpl: FetchImpl,
): Promise<GatewayLogEntry[]> {
    const out: GatewayLogEntry[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await fetchLogsPage(env, { startIso, endIso, page }, fetchImpl);
        out.push(...res.result);
        const total = res.result_info?.total_count;
        if (res.result.length < PER_PAGE) break;
        if (total != null && out.length >= total) break;
    }
    return out;
}

interface Bucket {
    requests: number;
    failures: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
}

function newBucket(): Bucket {
    return { requests: 0, failures: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
}

function addTo(bucket: Bucket, entry: GatewayLogEntry): void {
    bucket.requests += 1;
    if (!entry.success) bucket.failures += 1;
    bucket.tokensIn += num(entry.tokens_in);
    bucket.tokensOut += num(entry.tokens_out);
    bucket.costUsd += num(entry.cost);
}

function toRows(map: Map<string, Bucket>, sortKey: "cost" | "requests"): GatewayBreakdownRow[] {
    const rows: GatewayBreakdownRow[] = [...map.entries()].map(([key, b]) => ({ key, ...b }));
    rows.sort((a, b) => (sortKey === "cost" ? b.costUsd - a.costUsd : b.requests - a.requests));
    return rows;
}

/**
 * Aggregate gateway logs for the report day (plus the 7-day trend window).
 * Throws GatewayLogsError on any API failure — the caller (aggregate.ts)
 * degrades that to gateway=null + a warning.
 */
export async function getGatewayAnalytics(
    env: Env,
    window: DateWindow,
    fetchImpl: FetchImpl = fetch,
): Promise<GatewayAnalytics> {
    const trendStart = trendStartIso(window, 7);

    const todayEntries = await fetchAllLogs(env, window.startIso, window.endIso, fetchImpl);
    const trendEntries = await fetchAllLogs(env, trendStart, window.endIso, fetchImpl);

    const today = newBucket();
    let successes = 0;
    let cachedRequests = 0;
    let durationSum = 0;
    let durationCount = 0;
    const byProvider = new Map<string, Bucket>();
    const byModel = new Map<string, Bucket>();
    const bySource = new Map<string, Bucket>();

    for (const e of todayEntries) {
        addTo(today, e);
        if (e.success) successes += 1;
        if (e.cached) cachedRequests += 1;
        if (typeof e.duration === "number") {
            durationSum += e.duration;
            durationCount += 1;
        }
        const provider = e.provider || "(unknown)";
        const model = e.model || "(unknown)";
        const source = parseLogSource(e.metadata);
        for (const [map, key] of [
            [byProvider, provider],
            [byModel, model],
            [bySource, source],
        ] as const) {
            const b = map.get(key) ?? newBucket();
            addTo(b, e);
            map.set(key, b);
        }
    }

    const trendByDay = new Map<string, Bucket>();
    for (const e of trendEntries) {
        const day = String(e.created_at ?? "").slice(0, 10);
        if (!day) continue;
        const b = trendByDay.get(day) ?? newBucket();
        addTo(b, e);
        trendByDay.set(day, b);
    }
    const dailyTrend: GatewayDailyRow[] = [...trendByDay.entries()]
        .map(([day, b]) => ({ day, ...b }))
        .sort((a, b) => a.day.localeCompare(b.day));

    return {
        gatewayId: env.AI_GATEWAY_ID ?? "",
        today: {
            requests: today.requests,
            successes,
            failures: today.failures,
            tokensIn: today.tokensIn,
            tokensOut: today.tokensOut,
            costUsd: today.costUsd,
            cachedRequests,
            avgDurationMs: durationCount > 0 ? durationSum / durationCount : null,
        },
        byProvider: toRows(byProvider, "cost"),
        byModel: toRows(byModel, "cost"),
        bySource: toRows(bySource, "cost"),
        dailyTrend,
    };
}
