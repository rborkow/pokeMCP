import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";
import { getAnalyticsBinding, trackAIChat } from "@/lib/ai/analytics";
import { createAnthropicClient } from "@/lib/ai/anthropic-client";
import { logGatewayHealthOnce } from "@/lib/ai/gateway-health";
import { checkOrigin, checkRateLimit, readJsonBody } from "@/lib/api/ai-guard";
import { getReport } from "@/lib/reports";

/**
 * In-context Q&A over a published meta report.
 *
 * Stateless SSE endpoint: the client sends { slug, month, question, history }.
 * The report identity is validated against the manifest (never an arbitrary
 * URL), then the published page's own HTML is fetched and stripped to text as
 * the grounding context — so the model answers from exactly what the reader
 * sees, including hand-edited content. Emits a minimal SSE protocol:
 * {type:"delta",text} / {type:"done"} / {type:"error",message}.
 */

// 6 questions per minute per IP (shared guard, CF binding-backed).
const RATE_LIMIT = { route: "report", limit: 6, bindingName: "AI_RATE_LIMITER_STRICT" };

const MAX_QUESTION_CHARS = 500;
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_MESSAGE_CHARS = 2_000;
const MAX_CONTEXT_CHARS = 24_000;
const CONTEXT_CACHE_TTL_MS = 5 * 60_000;

const contextCache = new Map<string, { text: string; fetchedAt: number }>();

/** Strip a report page's HTML to plain text, keeping tables readable. */
function htmlToText(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<\/(td|th)>/gi, " | ")
        .replace(/<\/(tr|p|h1|h2|h3|li|table)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/[ \t]+/g, " ")
        .replace(/ ?\n ?/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, MAX_CONTEXT_CHARS);
}

/**
 * Production path: the report page is fully prerendered and stored by the
 * OpenNext static-assets incremental cache as a JSON `.cache` file in the
 * ASSETS binding. Reading it there avoids the worker fetching its own URL
 * (recursion guards) and always matches what the reader sees.
 */
async function loadHtmlFromAssets(path: string): Promise<string | null> {
    try {
        const env = getCloudflareContext().env as CloudflareEnv;
        if (!env.ASSETS) return null;
        const buildId = process.env.NEXT_BUILD_ID ?? "no-build-id";
        const name = `cdn-cgi/_next_cache/${buildId}${path}.cache`.replace(/\/+/g, "/");
        const response = await env.ASSETS.fetch(`http://assets.local/${name}`);
        if (!response.ok) {
            await response.body?.cancel();
            return null;
        }
        const data = (await response.json()) as { html?: string };
        return data.html ?? null;
    } catch {
        return null;
    }
}

async function loadReportContext(origin: string, path: string): Promise<string | null> {
    const cached = contextCache.get(path);
    if (cached && Date.now() - cached.fetchedAt < CONTEXT_CACHE_TTL_MS) return cached.text;

    let html = await loadHtmlFromAssets(path);
    if (!html) {
        // Dev fallback (next dev / wrangler dev serve the page directly).
        const response = await fetch(`${origin}${path}`, { headers: { Accept: "text/html" } });
        if (!response.ok) return null;
        html = await response.text();
    }

    const text = htmlToText(html);
    contextCache.set(path, { text, fetchedAt: Date.now() });
    return text;
}

function systemPrompt(reportTitle: string, context: string): string {
    return `You are the PokeMCP meta-report assistant. You answer reader questions about ONE published meta report: "${reportTitle}".

The full report content is below. It is your ONLY source of truth.

Rules:
- Ground every claim in the report content. Quote the report's numbers exactly; never invent usage percentages, builds, or results.
- If the report does not contain the answer, say so plainly and suggest what the report DOES cover. Do not answer from general knowledge about Pokémon competitive play beyond basic rules/terminology.
- Be concise — 1-3 short paragraphs, or a short list. This is a sidebar chat, not an article.
- When a question is about building a team, answer from the report's data and mention that the secondary team builder at /build can check coverage against these threats.
- Usage stats in the report are weighted Pokémon Showdown ladder statistics published by Smogon; tournament results come from Limitless. Say so if asked about sources.

=== REPORT CONTENT ===

${context}`;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface ReportChatBody {
    slug: string;
    month: string;
    question: string;
    history?: ChatMessage[];
}

const sse = (data: Record<string, unknown>): string => `data: ${JSON.stringify(data)}\n\n`;

export async function POST(request: NextRequest) {
    logGatewayHealthOnce("report-stream");

    const originError = checkOrigin(request);
    if (originError) return originError;

    const rateLimitError = await checkRateLimit(request, RATE_LIMIT);
    if (rateLimitError) return rateLimitError;

    const rawBody = await readJsonBody(request);
    if (!rawBody.ok) return rawBody.response;
    const body = rawBody.data as ReportChatBody;

    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > MAX_QUESTION_CHARS) {
        return new Response(JSON.stringify({ error: "Question must be 1-500 characters" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    // The report must exist in the manifest — this is what stops the route
    // from being used to fetch arbitrary URLs.
    const report = getReport(body.slug, body.month);
    if (!report) {
        return new Response(JSON.stringify({ error: "Unknown report" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ error: "Claude API key not configured" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
        });
    }

    const context = await loadReportContext(
        request.nextUrl.origin,
        `/reports/${report.slug}/${report.month}`,
    );
    if (!context) {
        return new Response(JSON.stringify({ error: "Report content unavailable" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
        });
    }

    const history: ChatMessage[] = (Array.isArray(body.history) ? body.history : [])
        .filter(
            (m): m is ChatMessage =>
                (m?.role === "user" || m?.role === "assistant") &&
                typeof m?.content === "string" &&
                m.content.length > 0,
        )
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_MESSAGE_CHARS) }));

    const client = createAnthropicClient("report");
    const stream = client.messages.stream(
        {
            model: "claude-sonnet-4-6",
            max_tokens: 1200,
            // The report context is identical across every question on the same
            // page — cache it so follow-ups only pay for the conversation.
            system: [
                {
                    type: "text",
                    text: systemPrompt(report.title, context),
                    cache_control: { type: "ephemeral" },
                },
            ],
            messages: [...history, { role: "user", content: question }],
        },
        { signal: request.signal },
    );

    const encoder = new TextEncoder();
    const streamStartTime = performance.now();
    const analytics = getAnalyticsBinding();

    const readable = new ReadableStream({
        async start(controller) {
            const emit = (data: string) => controller.enqueue(encoder.encode(data));
            try {
                stream.on("text", (delta) => emit(sse({ type: "delta", text: delta })));
                const finalMsg = await stream.finalMessage();
                emit(sse({ type: "done" }));

                trackAIChat(analytics, {
                    format: report.slug,
                    personality: "_report_chat",
                    mode: report.slug === "ou" ? "singles" : "vgc",
                    thinking: false,
                    inputTokens: finalMsg.usage.input_tokens ?? 0,
                    outputTokens: finalMsg.usage.output_tokens ?? 0,
                    cacheCreationTokens: finalMsg.usage.cache_creation_input_tokens ?? 0,
                    cacheReadTokens: finalMsg.usage.cache_read_input_tokens ?? 0,
                    teamSize: 0,
                    responseTimeMs: Math.round(performance.now() - streamStartTime),
                    source: "web",
                });
                controller.close();
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") {
                    controller.close();
                    return;
                }
                console.error("Report chat stream error:", err);
                emit(sse({ type: "error", message: "Something went wrong — try again." }));
                controller.close();
            }
        },
        cancel() {
            stream.abort();
        },
    });

    return new Response(readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
