/**
 * Analytics Engine instrumentation for the teambuilder AI routes.
 *
 * Writes `ai_chat` events to the shared `pokemcp-analytics` dataset using the
 * SAME slot mapping as the MCP Worker's `src/analytics.ts` and the admin
 * dashboard queries in `src/admin.ts`, so token/cost data from the web chat and
 * interview synthesis shows up alongside `tool_call` / `session` events.
 *
 * Slot mapping (must stay in sync with src/analytics.ts):
 *   indexes[0] = "ai_chat"
 *   blobs   = [format, personality, mode, thinking("1"|"0"), source]
 *   doubles = [input, output, cacheCreation, cacheRead, teamSize, responseMs, costUsd]
 *
 * The binding must be captured in request context (getCloudflareContext is
 * AsyncLocalStorage-backed); capture it at the top of the handler and pass it
 * into the stream closure, since the stream body is pulled after the handler
 * returns.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

// Claude Sonnet 4 pricing (USD per million tokens) — matches src/analytics.ts.
const PRICING = {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
};

export function estimateCost(t: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
}): number {
    return (
        (t.inputTokens * PRICING.input) / 1_000_000 +
        (t.outputTokens * PRICING.output) / 1_000_000 +
        (t.cacheCreationTokens * PRICING.cacheWrite) / 1_000_000 +
        (t.cacheReadTokens * PRICING.cacheRead) / 1_000_000
    );
}

interface AnalyticsDataPoint {
    indexes?: string[];
    blobs?: (string | null)[];
    doubles?: number[];
}

interface AnalyticsEngine {
    writeDataPoint(point: AnalyticsDataPoint): void;
}

/**
 * Resolve the ANALYTICS binding from the Cloudflare context. Returns undefined
 * if unavailable (e.g. `next dev` without OpenNext dev init) — callers no-op.
 */
export function getAnalyticsBinding(): AnalyticsEngine | undefined {
    try {
        const env = getCloudflareContext().env as CloudflareEnv;
        return env.ANALYTICS;
    } catch {
        return undefined;
    }
}

export interface AiChatEvent {
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
    source?: "web" | "mcp" | "rest";
}

/** Fire-and-forget — writeDataPoint is synchronous and non-blocking. */
export function trackAIChat(analytics: AnalyticsEngine | undefined, data: AiChatEvent): void {
    if (!analytics) return;
    const cost = estimateCost(data);
    try {
        analytics.writeDataPoint({
            indexes: ["ai_chat"],
            blobs: [
                data.format,
                data.personality,
                data.mode,
                data.thinking ? "1" : "0",
                data.source ?? "web",
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
    } catch (error) {
        console.error("[Analytics] ai_chat write failed:", error);
    }
}
