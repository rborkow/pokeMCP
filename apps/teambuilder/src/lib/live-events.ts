import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
    type EventIndexEntry,
    type EventPageData,
    getEventBySlug,
    getEventsIndex,
} from "@/lib/event-pages";

interface EventRow {
    data_json: string;
    fetched_at: string;
}

const STALE_AFTER_MS = 48 * 60 * 60 * 1_000;

/**
 * Whether the results are being kept up to date.
 *
 * This asks when the worker's daily job last succeeded, not how recent the
 * newest event is. The job can run perfectly and find nothing new — only one
 * or two events a day are large enough to list — and judging by event age
 * made the page say "Update delayed" on every quiet day. The newest row's
 * fetch time is the fallback when the job history cannot be read.
 */
export function newsroomFreshness(
    lastSuccessfulCheck: string | null,
    newestFetchedAt: string | null,
    nowMs: number,
): { checkedAt: string | null; stale: boolean } {
    const checkedAt = lastSuccessfulCheck ?? newestFetchedAt;
    return {
        checkedAt,
        stale: checkedAt ? nowMs - new Date(checkedAt).getTime() > STALE_AFTER_MS : true,
    };
}

async function lastSuccessfulCheck(env: CloudflareEnv): Promise<string | null> {
    try {
        const row = await env.META_DB.prepare(
            "SELECT finished_at FROM ingestion_job WHERE job_type = 'limitless-daily' AND status = 'success' ORDER BY started_at DESC LIMIT 1",
        ).first<{ finished_at: string | null }>();
        return row?.finished_at ?? null;
    } catch {
        return null;
    }
}

export async function getNewsroomEvents(): Promise<{
    events: EventIndexEntry[];
    /** When the results were last checked for new events. */
    fetchedAt: string | null;
    stale: boolean;
}> {
    try {
        const env = getCloudflareContext().env as CloudflareEnv;
        // Newest events across every regulation. Filtering on one regulation
        // id froze the newsroom on Reg M-B after the worker began ingesting
        // Reg M-C events; each event carries its own regulation label.
        const rows = await env.META_DB.prepare(
            "SELECT data_json, fetched_at FROM tournament_event ORDER BY event_date DESC LIMIT 12",
        ).all<EventRow>();
        if (rows.results.length) {
            const data = rows.results.map((row) => JSON.parse(row.data_json) as EventPageData);
            const newestFetchedAt =
                rows.results
                    .map((row) => row.fetched_at)
                    .sort()
                    .at(-1) ?? null;
            const { checkedAt, stale } = newsroomFreshness(
                await lastSuccessfulCheck(env),
                newestFetchedAt,
                Date.now(),
            );
            return {
                events: data.map(({ slug, name, date, players, format, regulationLabel }) => ({
                    slug,
                    name,
                    date,
                    players,
                    format,
                    regulationLabel,
                })),
                fetchedAt: checkedAt,
                stale,
            };
        }
    } catch {
        // Build time and next dev can use the generated, source-controlled snapshot.
    }
    const events = getEventsIndex().champions ?? [];
    const latestDate = events[0]?.date ?? null;
    return { events, fetchedAt: latestDate, stale: false };
}

export async function getEventForRequest(slug: string): Promise<EventPageData | null> {
    try {
        const env = getCloudflareContext().env as CloudflareEnv;
        const row = await env.META_DB.prepare(
            "SELECT data_json FROM tournament_event WHERE slug = ? LIMIT 1",
        )
            .bind(slug)
            .first<{ data_json: string }>();
        if (row) return JSON.parse(row.data_json) as EventPageData;
    } catch {
        // Fall back to generated event JSON outside the Cloudflare runtime.
    }
    return getEventBySlug(slug);
}
