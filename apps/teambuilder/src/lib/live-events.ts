import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
    type EventIndexEntry,
    type EventPageData,
    getEventBySlug,
    getEventsIndex,
} from "@/lib/event-pages";
import { DEFAULT_CHAMPIONS_FORMAT } from "@/lib/prep/capabilities";

interface EventRow {
    data_json: string;
    fetched_at: string;
}

export async function getNewsroomEvents(): Promise<{
    events: EventIndexEntry[];
    fetchedAt: string | null;
    stale: boolean;
}> {
    try {
        const env = getCloudflareContext().env as CloudflareEnv;
        const rows = await env.META_DB.prepare(
            "SELECT data_json, fetched_at FROM tournament_event WHERE regulation_id = ? ORDER BY event_date DESC LIMIT 12",
        ).bind(DEFAULT_CHAMPIONS_FORMAT).all<EventRow>();
        if (rows.results.length) {
            const data = rows.results.map((row) => JSON.parse(row.data_json) as EventPageData);
            const fetchedAt = rows.results.map((row) => row.fetched_at).sort().at(-1) ?? null;
            return {
                events: data.map(({ slug, name, date, players, format, regulationLabel }) => ({
                    slug,
                    name,
                    date,
                    players,
                    format,
                    regulationLabel,
                })),
                fetchedAt,
                stale: fetchedAt ? Date.now() - new Date(fetchedAt).getTime() > 48 * 60 * 60 * 1_000 : true,
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
