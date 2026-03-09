/**
 * Analytics Engine instrumentation for usage monitoring
 *
 * Writes data points to Cloudflare Analytics Engine for real-time
 * queryable metrics. All data is privacy-preserving — no PII is recorded.
 *
 * Data point schema uses Analytics Engine's slots:
 * - indexes[0]: event type ("tool_call", "ai_chat", "session")
 * - blobs[0-4]: string dimensions (tool name, format, etc.)
 * - blob5 (tool_call, ai_chat) / blob4 (session): source tag ("web", "mcp", "rest")
 * - doubles[0-6]: numeric metrics (tokens, response time, cost, etc.)
 */

// Claude Sonnet 4 pricing (USD per million tokens)
const PRICING = {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
};

/**
 * Estimate cost in USD from token counts
 */
export function estimateCost(tokens: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
}): number {
    return (
        (tokens.inputTokens * PRICING.input) / 1_000_000 +
        (tokens.outputTokens * PRICING.output) / 1_000_000 +
        (tokens.cacheCreationTokens * PRICING.cacheWrite) / 1_000_000 +
        (tokens.cacheReadTokens * PRICING.cacheRead) / 1_000_000
    );
}

/** Valid source tags for tracking */
export type TrackingSource = "web" | "mcp" | "rest";

/**
 * Track a tool call event.
 * Fire-and-forget — writeDataPoint is synchronous.
 */
export function trackToolCall(
    env: Env,
    toolName: string,
    format: string | undefined,
    success: boolean,
    responseTimeMs: number,
    sessionId?: string,
    source?: TrackingSource,
): void {
    if (!env.ANALYTICS) {
        console.warn("[Analytics] SKIP tool_call: ANALYTICS binding missing");
        return;
    }

    env.ANALYTICS.writeDataPoint({
        indexes: ["tool_call"],
        blobs: [toolName, format ?? "", success ? "1" : "0", sessionId ?? "", source ?? ""],
        doubles: [responseTimeMs],
    });
    console.log(
        `[Analytics] tool_call written: ${toolName} (${format ?? "no-format"}) [${source ?? "unknown"}]`,
    );
}

/**
 * Track an AI chat request event.
 * Fire-and-forget — writeDataPoint is synchronous.
 */
export function trackAIChat(
    env: Env,
    data: {
        format: string;
        personality: string;
        mode: string;
        thinking: boolean;
        inputTokens: number;
        outputTokens: number;
        cacheCreationTokens: number;
        cacheReadTokens: number;
        teamSize: number;
        responseTimeMs: number;
        source?: TrackingSource;
    },
): void {
    if (!env.ANALYTICS) {
        console.warn("[Analytics] SKIP ai_chat: ANALYTICS binding missing");
        return;
    }

    const cost = estimateCost({
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        cacheCreationTokens: data.cacheCreationTokens,
        cacheReadTokens: data.cacheReadTokens,
    });

    env.ANALYTICS.writeDataPoint({
        indexes: ["ai_chat"],
        blobs: [
            data.format,
            data.personality,
            data.mode,
            data.thinking ? "1" : "0",
            data.source ?? "",
        ],
        doubles: [
            data.inputTokens,
            data.outputTokens,
            data.cacheCreationTokens,
            data.cacheReadTokens,
            data.teamSize,
            data.responseTimeMs,
            cost,
        ],
    });
    console.log(
        `[Analytics] ai_chat written: ${data.format}/${data.personality} [${data.source ?? "unknown"}]`,
    );
}

/**
 * Track a session lifecycle event (connect/disconnect).
 * Fire-and-forget — writeDataPoint is synchronous.
 */
export function trackSession(
    env: Env,
    action: "connect" | "disconnect",
    sessionId: string,
    transport: "sse" | "mcp" | "rest",
    source?: TrackingSource,
): void {
    if (!env.ANALYTICS) {
        console.warn("[Analytics] SKIP session: ANALYTICS binding missing");
        return;
    }

    env.ANALYTICS.writeDataPoint({
        indexes: ["session"],
        blobs: [action, sessionId, transport, source ?? ""],
        doubles: [],
    });
    console.log(`[Analytics] session written: ${action} [${source ?? "unknown"}]`);
}
