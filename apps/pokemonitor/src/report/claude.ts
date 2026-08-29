/**
 * The single Claude summarization call.
 *
 * Deterministic code has already assembled DailyMetrics; this is the one place
 * the model is involved. It writes the narrative, flags anomalies, and
 * categorizes query types — a fixed, bounded task, which is exactly why a
 * Managed Agent would be overkill here. Uses Opus 4.8 with adaptive thinking and
 * structured output so the report always has the same sections.
 *
 * (No prompt caching: at one call/day there's nothing to amortize, and the
 * prompt is well under Opus's 4096-token cache minimum.)
 */

import Anthropic from "@anthropic-ai/sdk";
import type { DailyMetrics, ReportNarrative } from "../types";

const MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = `You are an analytics assistant producing the daily operations report for pokeMCP — a
Model Context Protocol server plus web app for competitive Pokémon team building. Each day you receive a
JSON snapshot of metrics for one UTC day, including a 7-day trend window.

Write for the solo developer/operator. Be concrete and quantitative: cite the actual numbers and
day-over-day or vs-trend deltas. Prioritize, in order: (1) Claude API usage and cost health
(tokens, cache-hit rate, cost, per-source/format breakdown), (2) what users are actually doing
(tool/query-type mix and the sampled interaction digest), (3) traffic and compute/storage health.

Rules:
- Only state numbers present in the data. Never invent metrics. If a section is null/missing, say so
  briefly rather than guessing.
- "notable_changes" should reference the 7-day trend (e.g. cost up 40% vs the prior 6-day average).
- "query_interaction_insights" should interpret the tool distribution + sampled Pokémon/formats/examples
  into plain-language observations about user behavior.
- "anomalies" is for things worth attention: cost spikes, error-rate jumps, a collapsed cache-hit rate,
  a tool with a low success rate, or a traffic anomaly. Empty array if nothing stands out.
- Keep each string tight (one or two sentences). No markdown headers inside the strings.`;

const REPORT_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        executive_summary: { type: "string" },
        notable_changes: { type: "array", items: { type: "string" } },
        query_interaction_insights: { type: "array", items: { type: "string" } },
        cost_commentary: { type: "string" },
        anomalies: { type: "array", items: { type: "string" } },
    },
    required: [
        "executive_summary",
        "notable_changes",
        "query_interaction_insights",
        "cost_commentary",
        "anomalies",
    ],
} as const;

function createClient(env: Env): Anthropic {
    if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
    const gatewayUrl = env.CLOUDFLARE_AI_GATEWAY_URL;
    if (!gatewayUrl) return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY,
        baseURL: gatewayUrl,
        defaultHeaders: {
            ...(env.CF_AIG_TOKEN && { "cf-aig-authorization": `Bearer ${env.CF_AIG_TOKEN}` }),
            "cf-aig-metadata": JSON.stringify({ source: "pokemonitor" }),
        },
    });
}

export async function summarize(env: Env, metrics: DailyMetrics): Promise<ReportNarrative> {
    const client = createClient(env);

    const params = {
        model: MODEL,
        max_tokens: 4000,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        messages: [
            {
                role: "user",
                content: `Here is the metrics snapshot for ${metrics.window.day} (UTC). Produce the daily report.\n\n\`\`\`json\n${JSON.stringify(metrics, null, 2)}\n\`\`\``,
            },
        ],
        output_config: { format: { type: "json_schema", schema: REPORT_SCHEMA } },
        // `output_config` and adaptive `thinking` are passed through to the wire
        // even where the installed SDK's static types don't yet model them.
    } as unknown as Anthropic.MessageCreateParamsNonStreaming;

    const response = await client.messages.create(params);
    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
    if (!text) throw new Error("Claude returned no text block");

    try {
        return JSON.parse(text) as ReportNarrative;
    } catch {
        // Structured output should guarantee valid JSON; if a refusal or truncation
        // breaks it, fall back to surfacing the raw text rather than failing the run.
        return {
            executive_summary: text.slice(0, 1000),
            notable_changes: [],
            query_interaction_insights: [],
            cost_commentary: "",
            anomalies: ["Claude response was not valid structured JSON; showing raw text."],
        };
    }
}
