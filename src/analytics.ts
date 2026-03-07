/**
 * Analytics Engine instrumentation for usage monitoring
 *
 * Writes data points to Cloudflare Analytics Engine for real-time
 * queryable metrics. All data is privacy-preserving — no PII is recorded.
 *
 * Data point schema uses Analytics Engine's slots:
 * - indexes[0]: event type ("tool_call", "ai_chat", "session")
 * - blobs[0-4]: string dimensions (tool name, format, etc.)
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
): void {
    if (!env.ANALYTICS) return;

    env.ANALYTICS.writeDataPoint({
        indexes: ["tool_call"],
        blobs: [toolName, format ?? "", success ? "1" : "0", sessionId ?? ""],
        doubles: [responseTimeMs],
    });
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
    },
): void {
    if (!env.ANALYTICS) return;

    const cost = estimateCost({
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        cacheCreationTokens: data.cacheCreationTokens,
        cacheReadTokens: data.cacheReadTokens,
    });

    env.ANALYTICS.writeDataPoint({
        indexes: ["ai_chat"],
        blobs: [data.format, data.personality, data.mode, data.thinking ? "1" : "0"],
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
): void {
    if (!env.ANALYTICS) return;

    env.ANALYTICS.writeDataPoint({
        indexes: ["session"],
        blobs: [action, sessionId, transport],
        doubles: [],
    });
}
