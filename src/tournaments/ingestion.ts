/**
 * Daily tournament ingestion: completed Pokémon Champions events from the
 * Limitless API into META_DB, for the website's results pages.
 *
 * It reads the whole recent VGC feed rather than one regulation's. Events
 * carry their own regulation code, so results keep arriving when a new
 * regulation starts — before anyone has registered it here. The previous
 * version asked for a single registered regulation, and the results page
 * froze for six weeks when Regulation M-C replaced M-B.
 */
import { toID } from "../data-loader.js";
import { REGULATIONS } from "../regulations/registry.js";

const API_BASE = "https://play.limitlesstcg.com/api";
/** Smaller events rarely publish a meaningful top cut. */
const MIN_PLAYERS = 48;
/** How far back an event can be and still be picked up. */
const LOOKBACK_DAYS = 35;
const PAGE_SIZE = 100;
/** The feed runs at roughly 100 events per 10 days, so this covers the lookback with room. */
const MAX_PAGES = 6;
/**
 * Each event costs two Limitless requests and one D1 batch. Thirty keeps a
 * run well inside the Worker's subrequest budget and clears a month's backlog
 * in about four days, newest events first.
 */
const MAX_NEW_EVENTS_PER_RUN = 30;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1_000;

interface TournamentEnv extends Env {
    LIMITLESS_API_KEY?: string;
}

export interface ApiTournamentSummary {
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

/** A Limitless response we could not use. `status` is 0 for an oversized body. */
class LimitlessError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = "LimitlessError";
    }
}

// --- Regulations ---

export interface EventRegulation {
    id: string;
    label: string;
    /** Smogon usage-stats format for this regulation, when the registry knows one. */
    statsFormat?: string;
}

/** Champions regulations appear on Limitless as "M-A", "M-B", … */
const CHAMPIONS_FORMAT = /^M-([A-Z])$/;

/**
 * Map a Limitless format code to a regulation. Registered regulations use the
 * registry's id and name. A Champions code the registry does not know yet is
 * still accepted, with an id and label built the same way, so a new
 * regulation's events are not dropped. Anything else (custom formats, other
 * games' rulesets) returns null.
 */
export function regulationForFormat(format: string): EventRegulation | null {
    const registered = REGULATIONS.find((r) => r.limitlessFormatId === format);
    if (registered) {
        return {
            id: registered.id,
            label: registered.displayName,
            statsFormat: registered.showdownFormatId,
        };
    }
    const champions = CHAMPIONS_FORMAT.exec(format);
    if (!champions) return null;
    return {
        id: `champions-regm${champions[1].toLowerCase()}`,
        label: `Pokémon Champions — Regulation ${format}`,
    };
}

// --- Selection ---

/**
 * The events worth fetching this run: recent, completed, large enough, in a
 * Champions regulation and not already stored — newest first, capped.
 */
export function selectCandidates(
    summaries: ApiTournamentSummary[],
    existingIds: ReadonlySet<string>,
    nowMs: number,
    limit = MAX_NEW_EVENTS_PER_RUN,
): ApiTournamentSummary[] {
    const cutoffMs = nowMs - LOOKBACK_DAYS * DAY_MS;
    const seen = new Set<string>();
    return summaries
        .filter((summary) => {
            const time = new Date(summary.date).getTime();
            if (seen.has(summary.id) || existingIds.has(summary.id)) return false;
            seen.add(summary.id);
            return (
                summary.players >= MIN_PLAYERS &&
                time >= cutoffMs &&
                time <= nowMs &&
                regulationForFormat(summary.format) !== null
            );
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);
}

// --- Ladder comparison ---

/**
 * Ladder usage per species id from a usage index's name → usage map.
 *
 * The ladder lists a Mega Evolution as its own entry ("Charizard-Mega-Y")
 * while a tournament team sheet lists the species holding the stone. Each team
 * has at most one of a species, so the species' total is the sum of its plain
 * and Mega entries.
 */
export function ladderUsageBySpecies(pokemon: Record<string, number>): Map<string, number> {
    const usage = new Map<string, number>();
    for (const [name, value] of Object.entries(pokemon)) {
        const species = toID(name.replace(/-Mega(-[XYZ])?$/, ""));
        usage.set(species, (usage.get(species) ?? 0) + value);
    }
    return usage;
}

/** Loads each regulation's ladder usage at most once per run. Null when there is none. */
function createLadderLookup(env: TournamentEnv) {
    const cache = new Map<string, Promise<Map<string, number> | null>>();
    return (statsFormat: string | undefined) => {
        if (!statsFormat) return Promise.resolve(null);
        let entry = cache.get(statsFormat);
        if (!entry) {
            entry = (async () => {
                try {
                    const index = (await env.POKEMON_STATS.get(
                        `${statsFormat}:_index`,
                        "json",
                    )) as {
                        pokemon?: Record<string, number>;
                    } | null;
                    return index?.pokemon ? ladderUsageBySpecies(index.pokemon) : null;
                } catch {
                    return null;
                }
            })();
            cache.set(statsFormat, entry);
        }
        return entry;
    };
}

// --- Limitless API ---

function eventSlug(name: string, date: string) {
    const cleaned = name
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
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
        throw new LimitlessError(`Limitless response exceeded ${MAX_RESPONSE_BYTES} bytes`, 0);
    }
    if (!response.ok) {
        await response.body?.cancel();
        throw new LimitlessError(
            `Limitless API returned ${response.status} for ${path}`,
            response.status,
        );
    }
    return response.json<T>();
}

/** The recent VGC feed, newest first, paged back to the lookback window. */
async function listRecentEvents(env: TournamentEnv, nowMs: number) {
    const cutoffMs = nowMs - LOOKBACK_DAYS * DAY_MS;
    const events: ApiTournamentSummary[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
        const batch = await api<ApiTournamentSummary[]>(
            env,
            `/tournaments?game=VGC&limit=${PAGE_SIZE}&page=${page}`,
        );
        events.push(...batch);
        const oldest = batch[batch.length - 1];
        if (batch.length < PAGE_SIZE || !oldest) break;
        if (new Date(oldest.date).getTime() < cutoffMs) break;
    }
    return events;
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

async function fetchEvent(
    env: TournamentEnv,
    summary: ApiTournamentSummary,
    regulation: EventRegulation,
    ladder: Map<string, number> | null,
) {
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
        regulationId: regulation.id,
        regulationLabel: regulation.label,
        source: "limitless",
        sourceUrl: `https://play.limitlesstcg.com/tournament/${summary.id}`,
        attribution: "Data via Limitless (play.limitlesstcg.com)",
        fetchedAt,
        topCut,
        topCutUsage,
        // The results page compares each Pokémon's share of the top cut with
        // its ladder usage. Null where the ladder has no figure for it.
        // Limitless ids are Showdown-shaped ("arcanine-hisui") where its display
        // names are not ("Hisuian Arcanine"), so match on the id first.
        usageComparison: topCutUsage.map((row) => ({
            ...row,
            ladderUsage: ladder?.get(toID(row.id)) ?? ladder?.get(toID(row.name)) ?? null,
        })),
    };
}

type StoredEvent = NonNullable<Awaited<ReturnType<typeof fetchEvent>>>;

/** One event and its top cut, written atomically. */
async function storeEvent(env: TournamentEnv, event: StoredEvent) {
    await env.META_DB.batch([
        env.META_DB.prepare(
            `INSERT INTO tournament_event
             (id, slug, name, event_date, players, format, regulation_id, source_url, data_json, fetched_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, fetched_at = excluded.fetched_at`,
        ).bind(
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
        ),
        ...event.topCut.map((placing) =>
            env.META_DB.prepare(
                `INSERT INTO tournament_team
                 (id, event_id, placing, player, record_json, team_json, fetched_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(event_id, placing) DO UPDATE SET player = excluded.player,
                 record_json = excluded.record_json, team_json = excluded.team_json,
                 fetched_at = excluded.fetched_at`,
            ).bind(
                `${event.id}:${placing.placing}`,
                event.id,
                placing.placing,
                placing.player,
                placing.record ? JSON.stringify(placing.record) : null,
                JSON.stringify(placing.team),
                event.fetchedAt,
            ),
        ),
    ]);
}

// --- Entry point ---

export async function refreshTournamentNewsroom(env: TournamentEnv) {
    const jobId = crypto.randomUUID();
    const nowMs = Date.now();
    await env.META_DB.prepare(
        "INSERT INTO ingestion_job (id, job_type, started_at, status) VALUES (?, 'limitless-daily', ?, 'running')",
    )
        .bind(jobId, new Date(nowMs).toISOString())
        .run();
    let fetchedCount = 0;
    let skippedCount = 0;
    try {
        const summaries = await listRecentEvents(env, nowMs);
        const existing = await env.META_DB.prepare(
            "SELECT id FROM tournament_event WHERE event_date >= ?",
        )
            .bind(new Date(nowMs - LOOKBACK_DAYS * DAY_MS).toISOString())
            .all<{ id: string }>();
        const candidates = selectCandidates(
            summaries,
            new Set(existing.results.map((row) => row.id)),
            nowMs,
        );

        const ladderFor = createLadderLookup(env);
        let rateLimited = false;
        for (const summary of candidates) {
            // selectCandidates only returns events with a regulation.
            const regulation = regulationForFormat(summary.format) as EventRegulation;
            try {
                const ladder = await ladderFor(regulation.statsFormat);
                const event = await fetchEvent(env, summary, regulation, ladder);
                if (!event) continue;
                await storeEvent(env, event);
                fetchedCount++;
            } catch (error) {
                // Being rate limited ends the run early; what is left is picked
                // up tomorrow. Any other failure costs only that one event.
                if (error instanceof LimitlessError && error.status === 429) {
                    rateLimited = true;
                    break;
                }
                skippedCount++;
                console.error(
                    JSON.stringify({
                        event: "tournament_event_skipped",
                        tournamentId: summary.id,
                        message: error instanceof Error ? error.message : "unknown",
                    }),
                );
            }
        }

        await env.META_DB.prepare(
            "UPDATE ingestion_job SET finished_at = ?, status = 'success', fetched_count = ? WHERE id = ?",
        )
            .bind(new Date().toISOString(), fetchedCount, jobId)
            .run();
        console.log(
            JSON.stringify({
                event: "tournament_ingestion_complete",
                jobId,
                listed: summaries.length,
                candidates: candidates.length,
                fetchedCount,
                skippedCount,
                rateLimited,
            }),
        );
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
