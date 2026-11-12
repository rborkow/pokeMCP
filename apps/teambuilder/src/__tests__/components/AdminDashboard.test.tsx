import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboard from "@/app/admin/page";
import { render, screen, waitFor } from "../test-utils";

// What the worker's admin API returns. Analytics Engine sends some numbers as
// strings, so the fixtures mix both.
const RESPONSES: Record<string, unknown> = {
    overview: {
        toolCalls: { total: "240", successes: "228", avg_response_ms: 92.4 },
        sessions: { connections: "61" },
        requests: {
            total: "512",
            errors: "9",
            rate_limited: "2",
            avg_ms: 140,
            p50_ms: 118,
            p95_ms: 410,
        },
    },
    usage: { data: [{ bucket: "2026-11-12 20:00:00", event_type: "tool_call", count: "12" }] },
    tools: {
        tools: [{ tool_name: "get_pokemon_usage", calls: 90, successes: 88, avg_response_ms: 75 }],
        formats: [{ format: "champions-regmc", calls: 200 }],
    },
    clients: {
        connections: [
            {
                client: "claude",
                client_name: "claude-ai",
                user_agent: "Claude-User",
                connections: "40",
            },
            {
                client: "chatgpt",
                client_name: "openai-mcp",
                user_agent: "openai-mcp",
                connections: "21",
            },
        ],
        toolCalls: [
            { client: "claude", calls: "180" },
            { client: "chatgpt", calls: "60" },
        ],
    },
    performance: {
        requests: [
            {
                kind: "tools/call",
                requests: "240",
                errors: "0",
                avg_ms: 120,
                p50_ms: 96,
                p95_ms: 380,
            },
            { kind: "initialize", requests: "61", errors: "0", avg_ms: 30, p50_ms: 22, p95_ms: 70 },
            { kind: "rate_limited", requests: "2", errors: "2", avg_ms: 0, p50_ms: 0, p95_ms: 0 },
        ],
        statuses: [
            { status: "200", requests: "501" },
            { status: "429", requests: "2" },
        ],
    },
};

function mockAdminApi(overrides: Record<string, unknown> = {}) {
    const requested: string[] = [];
    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            const endpoint = /\/api\/admin\/([a-z]+)/.exec(url)?.[1] ?? "";
            requested.push(endpoint);
            const body = { ...RESPONSES, ...overrides }[endpoint];
            if (body === undefined) return new Response("{}", { status: 404 });
            return new Response(JSON.stringify(body), { status: 200 });
        }),
    );
    return requested;
}

describe("admin dashboard", () => {
    beforeEach(() => {
        vi.useRealTimers();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("shows connections, tool calls, response time and failures", async () => {
        const requested = mockAdminApi();
        render(<AdminDashboard />);

        await waitFor(() =>
            expect(screen.getByText("95.0% returned a result")).toBeInTheDocument(),
        );
        // The same counts also appear in the tables further down.
        expect(screen.getAllByText("61").length).toBeGreaterThan(0);
        expect(screen.getAllByText("240").length).toBeGreaterThan(0);
        expect(screen.getByText("118ms")).toBeInTheDocument();
        expect(screen.getByText("typical; slowest 5% above 410ms")).toBeInTheDocument();
        expect(screen.getByText("1.8% of 512, 2 rate-limited")).toBeInTheDocument();

        expect(new Set(requested)).toEqual(
            new Set(["overview", "usage", "tools", "clients", "performance"]),
        );
    });

    it("splits usage by assistant and shows what each client calls itself", async () => {
        mockAdminApi();
        render(<AdminDashboard />);

        await waitFor(() => expect(screen.getByText("Claude")).toBeInTheDocument());
        expect(screen.getByText("ChatGPT")).toBeInTheDocument();
        expect(screen.getByText("75.0%")).toBeInTheDocument();
        expect(screen.getByText("25.0%")).toBeInTheDocument();
        expect(screen.getByText("claude-ai")).toBeInTheDocument();
        expect(screen.getAllByText("openai-mcp").length).toBeGreaterThan(0);
    });

    it("lists requests by kind with typical and slow response times", async () => {
        mockAdminApi();
        render(<AdminDashboard />);

        await waitFor(() => expect(screen.getByText("Call a tool")).toBeInTheDocument());
        expect(screen.getByText("Connect (initialize)")).toBeInTheDocument();
        expect(screen.getByText("Turned away by rate limit")).toBeInTheDocument();
        expect(screen.getByText("96ms")).toBeInTheDocument();
        expect(screen.getByText("380ms")).toBeInTheDocument();
        expect(screen.getByText(/200 × 501, 429 × 2/)).toBeInTheDocument();
    });

    it("falls back to averages when percentiles are unavailable", async () => {
        mockAdminApi({
            overview: {
                toolCalls: { total: 10, successes: 10, avg_response_ms: 50 },
                sessions: { connections: 3 },
                requests: { total: 20, errors: 0, rate_limited: 0, avg_ms: 140 },
                percentilesError: "Analytics Engine query failed: 400",
            },
            performance: {
                requests: [{ kind: "tools/call", requests: 10, errors: 0, avg_ms: 133 }],
                statuses: [{ status: "200", requests: 20 }],
                percentilesError: "Analytics Engine query failed: 400",
            },
        });
        render(<AdminDashboard />);

        await waitFor(() => expect(screen.getByText("140ms")).toBeInTheDocument());
        expect(screen.getByText("average per request")).toBeInTheDocument();
        expect(screen.getByText("133ms")).toBeInTheDocument();
        expect(screen.getByText(/Percentiles are unavailable/)).toBeInTheDocument();
    });

    it("says so when there is no usage yet", async () => {
        mockAdminApi({
            overview: { toolCalls: {}, sessions: {}, requests: {} },
            usage: { data: [] },
            tools: { tools: [], formats: [] },
            clients: { connections: [], toolCalls: [] },
            performance: { requests: [], statuses: [] },
        });
        render(<AdminDashboard />);

        await waitFor(() =>
            expect(screen.getByText("No connections in this range")).toBeInTheDocument(),
        );
        expect(screen.getAllByText("No requests in this range").length).toBeGreaterThan(0);
        expect(screen.getByText("None in this range")).toBeInTheDocument();
    });
});
