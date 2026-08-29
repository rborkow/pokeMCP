/**
 * Gather every source into a single deterministic DailyMetrics snapshot.
 *
 * Sources run concurrently; each is independently fault-tolerant so one bad
 * source degrades its section to null + a warning rather than failing the run.
 */

import { getClaudeAnalytics, getToolAnalytics } from "../sources/analyticsEngine";
import { getGatewayAnalytics } from "../sources/aiGatewayLogs";
import { getComputeAnalytics, getVisitorAnalytics } from "../sources/cloudflareGraphql";
import { getInteractionDigest } from "../sources/interactionLogs";
import type {
    ClaudeAnalytics,
    ComputeAnalytics,
    DailyMetrics,
    DateWindow,
    GatewayAnalytics,
    QueryAnalytics,
    VisitorAnalytics,
} from "../types";

export async function gatherDailyMetrics(env: Env, window: DateWindow): Promise<DailyMetrics> {
    const warnings: string[] = [];

    const claudeP = safe("claude", () => getClaudeAnalytics(env, window), warnings);
    const gatewayP = safe<GatewayAnalytics | null>(
        "gateway",
        () => getGatewayAnalytics(env, window),
        warnings,
    );
    const toolsP = safe("tools", () => getToolAnalytics(env, window), warnings);
    const digestP = safe("interactionDigest", () => getInteractionDigest(env, window), warnings);
    const computeP = safe<ComputeAnalytics | null>(
        "compute",
        () => getComputeAnalytics(env, window, warnings),
        warnings,
    );
    const visitorsP = safe<VisitorAnalytics | null>(
        "visitors",
        () => getVisitorAnalytics(env, window, warnings),
        warnings,
    );

    const [claude, tools, digest, compute, visitors, gateway] = await Promise.all([
        claudeP,
        toolsP,
        digestP,
        computeP,
        visitorsP,
        gatewayP,
    ]);

    const claudeAnalytics = (claude as ClaudeAnalytics | null) ?? null;
    const gatewayAnalytics = gateway ?? null;

    // Truthfulness checks — a zero-cost day is only believable when BOTH the
    // provider-side gateway logs and the product instrumentation agree there
    // were no requests, and the instrumentation isn't stale.
    warnings.push(...telemetryWarnings(claudeAnalytics, gatewayAnalytics, window));

    let queries: QueryAnalytics | null = null;
    if (tools) {
        queries = {
            toolStats: tools.toolStats,
            toolBySource: tools.toolBySource,
            sessions: tools.sessions,
            sampled: digest ?? null,
        };
    } else if (digest) {
        queries = { toolStats: [], toolBySource: [], sessions: null, sampled: digest };
    }

    return {
        window,
        generatedAtIso: new Date().toISOString(),
        claude: claudeAnalytics,
        gateway: gatewayAnalytics,
        queries,
        compute: compute ?? null,
        visitors: visitors ?? null,
        warnings,
    };
}

/**
 * Derive the warnings that keep the report honest about Anthropic usage.
 * Exported for direct testing — these rules are what replaced the old
 * false-$0 behavior.
 */
export function telemetryWarnings(
    claude: ClaudeAnalytics | null,
    gateway: GatewayAnalytics | null,
    window: DateWindow,
): string[] {
    const warnings: string[] = [];

    if (!gateway) {
        warnings.push(
            "gateway: AI Gateway logs unavailable — provider-side Anthropic spend is UNKNOWN. " +
                'The instrumented figures below only cover routes that emit ai_chat telemetry and must NOT be read as total Anthropic usage. Grant the CLOUDFLARE_API_TOKEN the "AI Gateway Read" permission (see README).',
        );
    }

    if (!claude) return warnings;

    const stale = claude.lastEventAtIso == null || claude.lastEventAtIso < window.startIso;

    if (claude.today.requests === 0) {
        if (stale) {
            const last = claude.lastEventAtIso ?? "never";
            warnings.push(
                `claude: no ai_chat telemetry in this window AND instrumented telemetry is stale (last event ${last}). ` +
                    "This is NOT confirmed $0 Anthropic usage — routes may be calling the model without emitting telemetry.",
            );
        } else if (!gateway) {
            warnings.push(
                "claude: zero instrumented requests this window, but provider-side gateway data is unavailable to confirm $0 usage.",
            );
        }
    } else if (stale) {
        warnings.push(
            `claude: ai_chat telemetry predates this window (last event ${claude.lastEventAtIso}) — figures reflect older traffic, not ${window.day}.`,
        );
    }

    // Cross-check: gateway saw requests the instrumentation missed entirely.
    if (gateway && gateway.today.requests > 0 && claude.today.requests === 0) {
        warnings.push(
            `gateway: AI Gateway logged ${gateway.today.requests} request(s) but instrumented ai_chat telemetry shows zero — some routes are not emitting telemetry. Treat the gateway totals as the spend figure.`,
        );
    }

    return warnings;
}

async function safe<T>(label: string, fn: () => Promise<T>, warnings: string[]): Promise<T | null> {
    try {
        return await fn();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[gather] ${label} failed:`, message);
        warnings.push(`${label}: ${message}`);
        return null;
    }
}
