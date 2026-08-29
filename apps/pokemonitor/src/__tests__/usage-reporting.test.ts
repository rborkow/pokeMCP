/**
 * Tests for the AI Gateway logs source, telemetry truthfulness, and rendering.
 *
 * These pin the behavior that fixes the false-$0 report: missing permission →
 * warning (never zero), stale instrumented telemetry → warning, gateway
 * aggregation + pagination correctness, and subject/render labeling.
 */

import { describe, expect, it } from "vitest";

// vi must come from vitest for the mock fetch helper
import { vi } from "vitest";

import { telemetryWarnings } from "../report/aggregate";
import { subjectUsage } from "../report/pipeline";
import { renderReportHtml } from "../report/render";
import type {
    ClaudeAnalytics,
    DailyMetrics,
    DateWindow,
    GatewayAnalytics,
    ReportNarrative,
} from "../types";
import { getGatewayAnalytics, parseLogSource } from "../sources/aiGatewayLogs";

const WINDOW: DateWindow = {
    startIso: "2026-08-20T00:00:00.000Z",
    endIso: "2026-08-21T00:00:00.000Z",
    day: "2026-08-20",
};

const TEST_ENV = {
    CLOUDFLARE_API_TOKEN: "test-token",
    CLOUDFLARE_ACCOUNT_ID: "acct123",
    AI_GATEWAY_ID: "pokemcp",
} as unknown as Env;

function claude(over: Partial<ClaudeAnalytics> = {}): ClaudeAnalytics {
    return {
        today: {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            costUsd: 0,
            avgResponseMs: null,
            cacheHitRate: 0,
        },
        byFormat: [],
        byPersonality: [],
        bySource: [],
        dailyTrend: [],
        lastEventAtIso: null,
        ...over,
    };
}

function gateway(over: Partial<GatewayAnalytics> = {}): GatewayAnalytics {
    return {
        gatewayId: "pokemcp",
        today: {
            requests: 0,
            successes: 0,
            failures: 0,
            tokensIn: 0,
            tokensOut: 0,
            costUsd: 0,
            cachedRequests: 0,
            avgDurationMs: null,
        },
        byProvider: [],
        byModel: [],
        bySource: [],
        dailyTrend: [],
        ...over,
    };
}

const NARRATIVE: ReportNarrative = {
    executive_summary: "summary",
    notable_changes: [],
    query_interaction_insights: [],
    cost_commentary: "",
    anomalies: [],
};

// --- telemetryWarnings: the false-$0 guard ---

describe("telemetryWarnings (false-$0 guard)", () => {
    it("flags unavailable gateway as unknown spend, not zero", () => {
        const warnings = telemetryWarnings(claude(), null, WINDOW);
        expect(warnings.join(" ")).toMatch(/spend is UNKNOWN/);
        expect(warnings.join(" ")).toMatch(/AI Gateway Read/);
    });

    it("flags zero instrumented requests while telemetry is stale", () => {
        const warnings = telemetryWarnings(
            claude({ lastEventAtIso: "2026-07-13T11:20:00.000Z" }),
            gateway(),
            WINDOW,
        );
        expect(warnings.join(" ")).toMatch(/NOT confirmed \$0/);
        expect(warnings.join(" ")).toMatch(/stale/);
    });

    it("flags gateway requests with zero instrumented telemetry as missing instrumentation", () => {
        const warnings = telemetryWarnings(
            claude({ lastEventAtIso: "2026-08-20T03:00:00.000Z" }),
            gateway({ today: { ...gateway().today, requests: 4 } }),
            WINDOW,
        );
        expect(warnings.join(" ")).toMatch(/not emitting telemetry/);
    });

    it("emits no false-$0 warning when telemetry is fresh and both sources agree on zero", () => {
        const warnings = telemetryWarnings(
            claude({ lastEventAtIso: "2026-08-20T12:00:00.000Z" }),
            gateway(),
            WINDOW,
        );
        expect(warnings.length).toBe(0);
    });

    it("warns when telemetry predates the window despite nonzero window totals", () => {
        const warnings = telemetryWarnings(
            claude({
                today: { ...claude().today, requests: 3, costUsd: 0.01 },
                lastEventAtIso: "2026-07-13T11:20:00.000Z",
            }),
            null,
            WINDOW,
        );
        expect(warnings.join(" ")).toMatch(/predates this window/);
    });
});

// --- subjectUsage: subject line must not imply $0 ---

describe("subjectUsage", () => {
    it("prefers gateway totals", () => {
        const m = metrics({
            gateway: gateway({ today: { ...gateway().today, costUsd: 1.23456 } }),
        });
        expect(subjectUsage(m)).toBe("$1.23 AI (gateway)");
    });

    it("falls back to instrumented cost, clearly labeled", () => {
        const m = metrics({
            claude: claude({ today: { ...claude().today, costUsd: 0.5 } }),
        });
        expect(subjectUsage(m)).toBe("$0.50 AI (instrumented only)");
    });

    it("says unknown when neither source is available", () => {
        expect(subjectUsage(metrics({}))).toBe("AI usage unknown");
    });
});

// --- render: honest labels and no "No data" zero implication ---

function metrics(partial: Partial<DailyMetrics>): DailyMetrics {
    return {
        window: WINDOW,
        generatedAtIso: "2026-08-21T08:00:00.000Z",
        claude: null,
        gateway: null,
        queries: null,
        compute: null,
        visitors: null,
        warnings: [],
        ...partial,
    };
}

describe("renderReportHtml truthfulness", () => {
    it("renders an explicit unavailable warning when gateway is missing", () => {
        const html = renderReportHtml(metrics({ warnings: ["gateway: denied"] }), NARRATIVE);
        expect(html).toMatch(/Provider-side usage unavailable/);
        expect(html).toMatch(/NOT confirmation of \$0 usage/);
        expect(html).toMatch(/spend for this day is UNKNOWN/);
    });

    it("labels instrumented section as not-total when gateway is unavailable", () => {
        const html = renderReportHtml(
            metrics({ claude: claude({ today: { ...claude().today, costUsd: 0.5 } }) }),
            NARRATIVE,
        );
        expect(html).toMatch(/NOT total Anthropic usage/);
    });

    it("marks instrumented section secondary when gateway is available", () => {
        const html = renderReportHtml(metrics({ claude: claude(), gateway: gateway() }), NARRATIVE);
        expect(html).toMatch(/secondary metric/);
        expect(html).toMatch(/Provider AI usage \(AI Gateway/);
    });

    it("warns visibly when instrumented telemetry is stale", () => {
        const html = renderReportHtml(
            metrics({
                claude: claude({ lastEventAtIso: "2026-07-13T11:20:00.000Z" }),
                gateway: gateway(),
            }),
            NARRATIVE,
        );
        expect(html).toMatch(/Telemetry is stale/);
    });
});

// --- gateway logs: pagination + aggregation + error handling ---

interface Entry {
    id: string;
    created_at: string;
    provider: string | null;
    model: string | null;
    success: boolean;
    cached: boolean;
    tokens_in: number;
    tokens_out: number;
    cost: number;
    duration: number;
    status_code: number;
    metadata?: unknown;
}

function entry(over: Partial<Entry>): Entry {
    return {
        id: "e",
        created_at: "2026-08-20T12:00:00.000Z",
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        success: true,
        cached: false,
        tokens_in: 100,
        tokens_out: 50,
        cost: 0.001,
        duration: 800,
        status_code: 200,
        ...over,
    };
}

function pageResponse(entries: Entry[], totalCount: number): Response {
    return new Response(
        JSON.stringify({
            result: entries,
            result_info: { total_count: totalCount },
            success: true,
        }),
        { status: 200 },
    );
}

describe("getGatewayAnalytics", () => {
    it("aggregates across paginated results until short page", async () => {
        const urls: string[] = [];
        const fetchMock = vi.fn(async (input: unknown) => {
            urls.push(String(input));
            const url = new URL(String(input));
            const page = Number(url.searchParams.get("page"));
            if (page === 1) return pageResponse([entry({ id: "a" }), entry({ id: "b" })], 2);
            return pageResponse([], 2);
        }) as unknown as typeof fetch;

        const result = await getGatewayAnalytics(TEST_ENV, WINDOW, fetchMock);

        expect(result.today.requests).toBe(2);
        expect(result.today.successes).toBe(2);
        expect(result.today.tokensIn).toBe(200);
        expect(result.today.tokensOut).toBe(100);
        expect(result.today.costUsd).toBeCloseTo(0.002);
        expect(result.today.avgDurationMs).toBe(800);
        expect(result.byProvider[0].key).toBe("anthropic");
        expect(result.byModel[0].key).toBe("claude-sonnet-4-6");
        expect(urls[0]).toContain("/ai-gateway/gateways/pokemcp/logs");
        expect(urls[0]).toContain("per_page=100");
    });

    it("groups by metadata source (string or object form)", async () => {
        const fetchMock = vi.fn(async () =>
            pageResponse(
                [
                    entry({ id: "a", metadata: '{"source":"prep"}' }),
                    entry({ id: "b", metadata: { source: "pokemonitor" } }),
                    entry({ id: "c", metadata: null }),
                ],
                3,
            ),
        ) as unknown as typeof fetch;

        const result = await getGatewayAnalytics(TEST_ENV, WINDOW, fetchMock);
        const sources = result.bySource.map((r) => r.key);
        expect(sources).toContain("prep");
        expect(sources).toContain("pokemonitor");
        expect(sources).toContain("(none)");
    });

    it("counts failures separately from successes", async () => {
        const fetchMock = vi.fn(async () =>
            pageResponse(
                [
                    entry({ id: "a", success: true }),
                    entry({ id: "b", success: false, status_code: 500 }),
                ],
                2,
            ),
        ) as unknown as typeof fetch;
        const result = await getGatewayAnalytics(TEST_ENV, WINDOW, fetchMock);
        expect(result.today.successes).toBe(1);
        expect(result.today.failures).toBe(1);
    });

    it("throws a permission-specific error on 403 (never returns zero)", async () => {
        const fetchMock = vi.fn(
            async () => new Response("forbidden", { status: 403 }),
        ) as unknown as typeof fetch;
        await expect(getGatewayAnalytics(TEST_ENV, WINDOW, fetchMock)).rejects.toThrow(
            /AI Gateway Read/,
        );
    });

    it("throws on non-success API envelope", async () => {
        const fetchMock = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({ result: [], success: false, errors: [{ message: "bad" }] }),
                    { status: 200 },
                ),
        ) as unknown as typeof fetch;
        await expect(getGatewayAnalytics(TEST_ENV, WINDOW, fetchMock)).rejects.toThrow("bad");
    });

    it("parseLogSource handles string, object, and empty metadata", () => {
        expect(parseLogSource('{"source":"web"}')).toBe("web");
        expect(parseLogSource({ source: "prep" })).toBe("prep");
        expect(parseLogSource("not json")).toBe("(none)");
        expect(parseLogSource(null)).toBe("(none)");
        expect(parseLogSource({ other: 1 })).toBe("(none)");
    });
});
