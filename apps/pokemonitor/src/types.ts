/**
 * Shared shapes for the daily report pipeline.
 *
 * `DailyMetrics` is the fully-assembled, deterministic snapshot that feeds both
 * the HTML renderer and the single Claude summarization call. Every source is
 * optional/nullable so a failure in one source (e.g. a GraphQL dataset that
 * isn't available yet) degrades that section rather than failing the whole run.
 */

export interface DateWindow {
    /** Inclusive UTC start, ISO 8601 (00:00:00Z of the report day). */
    startIso: string;
    /** Exclusive UTC end, ISO 8601 (00:00:00Z of the following day). */
    endIso: string;
    /** The report day as YYYY-MM-DD (UTC). */
    day: string;
}

// --- Claude API analytics (Analytics Engine `ai_chat`) ---

export interface AiChatTotals {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    costUsd: number;
    avgResponseMs: number | null;
    /** cache_read / (input + cache_read), 0..1. */
    cacheHitRate: number;
}

export interface BreakdownRow {
    key: string;
    requests: number;
    costUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
}

export interface DailyTrendRow {
    day: string;
    requests: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
}

export interface ClaudeAnalytics {
    today: AiChatTotals;
    byFormat: BreakdownRow[];
    byPersonality: BreakdownRow[];
    bySource: BreakdownRow[];
    /** Last 7 days (inclusive of report day) for trend commentary. */
    dailyTrend: DailyTrendRow[];
    /**
     * ISO timestamp of the most recent `ai_chat` datapoint ever observed in
     * the dataset, or null when the dataset is empty. Lets the report surface
     * stale instrumentation instead of implying $0 usage.
     */
    lastEventAtIso: string | null;
}

// --- AI Gateway logs (provider-side ground truth) ---

export interface GatewayLogTotals {
    requests: number;
    successes: number;
    failures: number;
    tokensIn: number;
    tokensOut: number;
    /** Sum of gateway-reported per-request cost (USD). */
    costUsd: number;
    cachedRequests: number;
    avgDurationMs: number | null;
}

export interface GatewayBreakdownRow {
    key: string;
    requests: number;
    failures: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
}

export interface GatewayDailyRow {
    day: string;
    requests: number;
    failures: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
}

export interface GatewayAnalytics {
    /** Gateway these logs came from (wrangler var AI_GATEWAY_ID). */
    gatewayId: string;
    today: GatewayLogTotals;
    byProvider: GatewayBreakdownRow[];
    byModel: GatewayBreakdownRow[];
    /** Grouped by cf-aig-metadata source (web/interview/report/prep/pokemonitor/…). */
    bySource: GatewayBreakdownRow[];
    /** Last 7 days (inclusive of report day). */
    dailyTrend: GatewayDailyRow[];
}

// --- Query types & interactions ---

export interface ToolStatRow {
    tool: string;
    calls: number;
    successes: number;
    avgResponseMs: number | null;
}

export interface InteractionSample {
    tool: string;
    format?: string;
    pokemon: string[];
    success: boolean;
}

export interface QueryAnalytics {
    /** Tool-call distribution from Analytics Engine `tool_call`. */
    toolStats: ToolStatRow[];
    toolBySource: BreakdownRow[];
    sessions: {
        events: number;
        connections: number;
        disconnections: number;
    } | null;
    /** Sampled digest from R2 interaction logs (10% sample). */
    sampled: {
        sampleSize: number;
        topPokemon: Array<{ name: string; count: number }>;
        topFormats: Array<{ format: string; count: number }>;
        exampleQueries: InteractionSample[];
    } | null;
}

// --- Compute & storage (Cloudflare GraphQL Analytics) ---

export interface WorkerCompute {
    script: string;
    requests: number;
    errors: number;
    subrequests: number;
    cpuTimeP50Us: number | null;
    cpuTimeP99Us: number | null;
}

export interface StorageUsage {
    r2: { objects: number | null; bytes: number | null } | null;
    kvKeys: number | null;
}

export interface ComputeAnalytics {
    workers: WorkerCompute[];
    storage: StorageUsage;
}

// --- Visitor metrics (Cloudflare Web Analytics / RUM) ---

export interface VisitorAnalytics {
    enabled: boolean;
    visits: number | null;
    pageViews: number | null;
    topPages: Array<{ path: string; views: number }>;
    topCountries: Array<{ country: string; visits: number }>;
    topReferrers: Array<{ referrer: string; visits: number }>;
}

// --- The full snapshot ---

export interface DailyMetrics {
    window: DateWindow;
    generatedAtIso: string;
    claude: ClaudeAnalytics | null;
    /**
     * Provider-side usage from the AI Gateway logs API — the primary spend
     * source when present. Null when unavailable (missing permission/config);
     * in that case `warnings` explains why and `claude` (instrumented product
     * telemetry) must not be presented as the total provider spend.
     */
    gateway: GatewayAnalytics | null;
    queries: QueryAnalytics | null;
    compute: ComputeAnalytics | null;
    visitors: VisitorAnalytics | null;
    /** Non-fatal source errors collected during gathering. */
    warnings: string[];
}

// --- Claude narrative (structured output) ---

export interface ReportNarrative {
    executive_summary: string;
    notable_changes: string[];
    query_interaction_insights: string[];
    cost_commentary: string;
    anomalies: string[];
}
