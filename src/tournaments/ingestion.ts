const API_BASE = "https://play.limitlesstcg.com/api";
const MIN_PLAYERS = 48;
const MAX_NEW_EVENTS_PER_RUN = 8;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

interface TournamentEnv extends Env {
    LIMITLESS_API_KEY?: string;
}

interface ApiTournamentSummary {
    id: string;
    game: string;
    format: string;
    name: string;
    date: string;
    players: number;
}

interface ApiTournamentDetails extends ApiTournamentSummary {
    decklists: boolean;
}

interface ApiStandingEntry {
    placing: number;
    name?: string;
    player?: string;
    country?: string;
    record?: { wins: number; losses: number; ties: number };
    decklist?: {
        id: string;
        name: string;
        item?: string;
        ability?: string;
        attacks?: string[];
        nature?: string;
    }[];
}

function eventSlug(name: string, date: string) {
    const cleaned = name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 88);
    return `${date.slice(0, 10)}-${cleaned}`;
}

async function api<T>(env: TournamentEnv, path: string): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (env.LIMITLESS_API_KEY) headers["X-Access-Key"] = env.LIMITLESS_API_KEY;
    const response = await fetch(`${API_BASE}${path}`, { headers });
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_RESPONSE_BYTES) {
        await response.body?.cancel();
        throw new Error(`Limitless response exceeded ${MAX_RESPONSE_BYTES} bytes`);
    }
    if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Limitless API returned ${response.status} for ${path}`);
    }
    return response.json<T>();
}

function normalizeTeam(decklist: ApiStandingEntry["decklist"]) {
    if (!decklist?.length) return null;
    const team = decklist.map((slot) => ({
        id: slot.id || slot.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
        name: slot.name,
        item: slot.item ?? null,
        ability: slot.ability ?? null,
        moves: (slot.attacks ?? []).slice(0, 4),
        nature: slot.nature ?? null,
    }));
    return team.length >= 4 ? team : null;
}

async function fetchEvent(env: TournamentEnv, summary: ApiTournamentSummary) {
    const details = await api<ApiTournamentDetails>(env, `/tournaments/${summary.id}/details`);
    if (!details.decklists) return null;
    const standings = await api<ApiStandingEntry[]>(env, `/tournaments/${summary.id}/standings`);
    const cutSize = summary.players >= 500 ? 16 : 8;
    const topCut = standings
        .filter((entry) => Number.isInteger(entry.placing))
        .sort((a, b) => a.placing - b.placing)
        .slice(0, cutSize)
        .flatMap((entry) => {
            const team = normalizeTeam(entry.decklist);
            return team
                ? [
                      {
                          placing: entry.placing,
                          player: entry.name ?? entry.player ?? "Unknown",
                          country: entry.country ?? null,
                          record: entry.record ?? null,
                          team,
                      },
                  ]
                : [];
        });
    if (topCut.length < Math.min(4, cutSize)) return null;

    const usage = new Map<string, { name: string; count: number }>();
    for (const placing of topCut) {
        for (const slot of placing.team) {
            const current = usage.get(slot.id);
            usage.set(slot.id, { name: slot.name, count: (current?.count ?? 0) + 1 });
        }
    }
    const topCutUsage = [...usage.entries()]
        .map(([id, value]) => ({
            id,
            name: value.name,
            count: value.count,
            pct: (value.count / topCut.length) * 100,
        }))
        .sort((a, b) => b.count - a.count);
    const fetchedAt = new Date().toISOString();
    return {
        id: summary.id,
        slug: eventSlug(summary.name, summary.date),
        name: summary.name,
        date: summary.date,
        players: summary.players,
        format: summary.format,
        regulationId: "champions-regmb",
        regulationLabel: "Pokémon Champions — Regulation M-B",
        source: "limitless",
        sourceUrl: `https://play.limitlesstcg.com/tournament/${summary.id}`,
        attribution: "Data via Limitless (play.limitlesstcg.com)",
        fetchedAt,
        topCut,
        topCutUsage,
        usageComparison: topCutUsage.map((row) => ({ ...row, ladderUsage: null })),
    };
}

export async function refreshTournamentNewsroom(env: TournamentEnv) {
    const jobId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    await env.META_DB.prepare(
        "INSERT INTO ingestion_job (id, job_type, started_at, status) VALUES (?, 'limitless-daily', ?, 'running')",
    )
        .bind(jobId, startedAt)
        .run();
    let fetchedCount = 0;
    try {
        const summaries = await api<ApiTournamentSummary[]>(
            env,
            "/tournaments?game=VGC&format=M-B&limit=100&page=1",
        );
        const existing = await env.META_DB.prepare(
            "SELECT id FROM tournament_event WHERE regulation_id = 'champions-regmb'",
        ).all<{ id: string }>();
        const existingIds = new Set(existing.results.map((row) => row.id));
        const cutoff = Date.now() - 35 * 24 * 60 * 60 * 1_000;
        const candidates = summaries
            .filter(
                (summary) =>
                    !existingIds.has(summary.id) &&
                    summary.players >= MIN_PLAYERS &&
                    new Date(summary.date).getTime() >= cutoff &&
                    new Date(summary.date).getTime() <= Date.now(),
            )
            .slice(0, MAX_NEW_EVENTS_PER_RUN);

        for (const summary of candidates) {
            const event = await fetchEvent(env, summary);
            if (!event) continue;
            await env.META_DB.prepare(
                `INSERT INTO tournament_event
                 (id, slug, name, event_date, players, format, regulation_id, source_url, data_json, fetched_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, fetched_at = excluded.fetched_at`,
            )
                .bind(
                    event.id,
                    event.slug,
                    event.name,
                    event.date,
                    event.players,
                    event.format,
                    event.regulationId,
                    event.sourceUrl,
                    JSON.stringify(event),
                    event.fetchedAt,
                )
                .run();
            for (const placing of event.topCut) {
                await env.META_DB.prepare(
                    `INSERT INTO tournament_team
                     (id, event_id, placing, player, record_json, team_json, fetched_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(event_id, placing) DO UPDATE SET player = excluded.player,
                     record_json = excluded.record_json, team_json = excluded.team_json,
                     fetched_at = excluded.fetched_at`,
                )
                    .bind(
                        `${event.id}:${placing.placing}`,
                        event.id,
                        placing.placing,
                        placing.player,
                        placing.record ? JSON.stringify(placing.record) : null,
                        JSON.stringify(placing.team),
                        event.fetchedAt,
                    )
                    .run();
            }
            fetchedCount++;
        }
        await env.META_DB.prepare(
            "UPDATE ingestion_job SET finished_at = ?, status = 'success', fetched_count = ? WHERE id = ?",
        )
            .bind(new Date().toISOString(), fetchedCount, jobId)
            .run();
        console.log(JSON.stringify({ event: "tournament_ingestion_complete", fetchedCount, jobId }));
        return { fetchedCount, jobId };
    } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
        await env.META_DB.prepare(
            "UPDATE ingestion_job SET finished_at = ?, status = 'failed', fetched_count = ?, error_message = ? WHERE id = ?",
        )
            .bind(new Date().toISOString(), fetchedCount, message, jobId)
            .run();
        throw error;
    }
}
