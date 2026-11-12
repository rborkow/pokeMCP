/**
 * Time the connector from outside, the way a client sees it.
 *
 * Each round opens a connection (`initialize`) and makes one call of each
 * kind: no I/O, KV, D1 and bundled data. A plain route is timed alongside so a
 * slow network or a slow Worker can be told apart from a slow MCP endpoint.
 *
 * Usage:
 *   bun run probe-connector                         # production, 12 rounds
 *   bun run probe-connector http://localhost:8787 5
 *
 * It only reads. Twelve rounds make 84 requests, well inside the rate limit.
 */
const BASE = process.argv[2] ?? "https://api.pokemcp.com";
const ROUNDS = Number(process.argv[3] ?? 12);
const TIMEOUT_MS = 45_000;
const HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
};

interface Sample {
    label: string;
    ms: number;
    ok: boolean;
}

async function post(
    body: unknown,
    sessionId: string | null,
): Promise<{ status: number; sessionId: string | null; text: string }> {
    const response = await fetch(`${BASE}/mcp`, {
        method: "POST",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
            ...HEADERS,
            // Sent only if the server issued one; a stateless server does not.
            ...(sessionId ? { "mcp-session-id": sessionId } : {}),
            "mcp-protocol-version": "2025-06-18",
        },
        body: JSON.stringify(body),
    });
    return {
        status: response.status,
        sessionId: response.headers.get("mcp-session-id"),
        text: await response.text(),
    };
}

async function timed(label: string, run: () => Promise<boolean>): Promise<Sample> {
    const started = performance.now();
    let ok = false;
    try {
        ok = await run();
    } catch {
        // A timeout or network error counts as a failure.
    }
    return { label, ms: performance.now() - started, ok };
}

const call = (id: number, name: string, args: Record<string, unknown>) => ({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
});

async function main() {
    const samples: Sample[] = [];

    for (let round = 0; round < ROUNDS; round++) {
        samples.push(
            await timed("health (plain route)", async () => {
                const response = await fetch(`${BASE}/health`, {
                    signal: AbortSignal.timeout(TIMEOUT_MS),
                });
                return response.ok;
            }),
        );

        let sessionId: string | null = null;
        const initialize = await timed("initialize (new connection)", async () => {
            const result = await post(
                {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "initialize",
                    params: {
                        protocolVersion: "2025-06-18",
                        capabilities: {},
                        clientInfo: { name: "perf-probe", version: "1.0.0" },
                    },
                },
                null,
            );
            sessionId = result.sessionId;
            return result.status === 200 && result.text.includes("serverInfo");
        });
        samples.push(initialize);
        if (!initialize.ok) continue;

        await post({ jsonrpc: "2.0", method: "notifications/initialized" }, sessionId).catch(
            () => undefined,
        );

        const requests: [string, unknown][] = [
            ["tools/list", { jsonrpc: "2.0", id: 2, method: "tools/list" }],
            ["list_formats (no I/O)", call(3, "list_formats", {})],
            ["get_top_usage (KV)", call(4, "get_top_usage", { limit: 3 })],
            ["get_meta_shifts (D1)", call(5, "get_meta_shifts", { limit: 3 })],
            [
                "validate_moveset (bundled data)",
                call(6, "validate_moveset", { pokemon: "Garchomp", moves: ["Earthquake"] }),
            ],
        ];
        for (const [label, body] of requests) {
            samples.push(
                await timed(label, async () => {
                    const result = await post(body, sessionId);
                    return result.status === 200 && !result.text.includes('"isError":true');
                }),
            );
        }
    }

    const labels = [...new Set(samples.map((sample) => sample.label))];
    const cell = (value: number | string) => String(value).padStart(7);
    console.log(`${BASE}  rounds=${ROUNDS}  ${new Date().toISOString()}`);
    console.log(
        `${"request".padEnd(34)}${cell("n")}${cell("failed")}${cell("min")}${cell("p50")}${cell("p90")}${cell("max")}  (ms)`,
    );
    let failures = 0;
    for (const label of labels) {
        const group = samples.filter((sample) => sample.label === label);
        const times = group.map((sample) => sample.ms).sort((a, b) => a - b);
        const percentile = (p: number) =>
            Math.round(times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))]);
        const failed = group.filter((sample) => !sample.ok).length;
        failures += failed;
        console.log(
            `${label.padEnd(34)}${cell(group.length)}${cell(failed)}${cell(Math.round(times[0]))}${cell(percentile(50))}${cell(percentile(90))}${cell(Math.round(times[times.length - 1]))}`,
        );
    }
    if (failures > 0) process.exit(1);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
