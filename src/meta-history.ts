/**
 * Usage history over time (D1 time-series).
 *
 * KV (POKEMON_STATS) holds the current month; META_DB holds one snapshot per
 * (format, month), written by the backfill and append scripts. This module is
 * the D1 reads and the trend computations the connector's trend tools build on
 * (src/connector/trends.ts).
 *
 * NOTE: a regulation only has history for the months its ladder was active.
 */

// --- Config & cache ---

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (mirrors stats.ts)
const cache = new Map<string, { data: unknown; timestamp: number }>();

const SOURCE = "smogon-chaos";
// Three monthly points is the least a trend line can be fitted to. Regulations
// last about three months, so a higher minimum meant momentum was never
// available for the regulation people are actually playing.
export const MIN_MOMENTUM_HISTORY = 3;
export const ENTRY_THRESHOLD = 0.02; // 2% usage to count as a meaningful entrant/dropout
const MOMENTUM_RELEVANCE = 0.02; // only track momentum for mons reaching ~2% usage

// --- Types ---

export interface BoardRow {
    pokemon_id: string;
    display_name: string;
    usage: number;
    rank: number;
    raw_count: number | null;
}

export interface MoverMetric {
    name: string;
    latest: number;
    delta: number;
    slope: number;
    ewma: number;
    volatility: number;
    acceleration: number;
}

// --- Small helpers ---

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.timestamp < CACHE_TTL_MS) return hit.data as T;
    const data = await fn();
    cache.set(key, { data, timestamp: now });
    return data;
}

function monthIndex(date: string): number {
    const [y, m] = date.split("-").map(Number);
    return y * 12 + (m - 1);
}

/** Nearest available snapshot date (by month distance) to a requested date. */
function nearest(dates: string[], target: string): string {
    let best = dates[0];
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const d of dates) {
        const diff = Math.abs(monthIndex(d) - monthIndex(target));
        if (diff < bestDiff) {
            bestDiff = diff;
            best = d;
        }
    }
    return best;
}

export function resolveRange(
    dates: string[],
    args: { from?: string; to?: string; window?: number },
    defaultWindow: number,
): { from: string; to: string; inRange: string[] } {
    const to = args.to
        ? dates.includes(args.to)
            ? args.to
            : nearest(dates, args.to)
        : dates[dates.length - 1];
    let from: string;
    if (args.from) {
        from = dates.includes(args.from) ? args.from : nearest(dates, args.from);
    } else {
        const w = args.window && args.window > 0 ? args.window : defaultWindow;
        const toIdx = dates.indexOf(to);
        from = dates[Math.max(0, toIdx - (w - 1))];
    }
    if (from > to) [from] = [to];
    const inRange = dates.filter((d) => d >= from && d <= to);
    return { from, to, inRange };
}

// --- Stats math (descriptive "prediction" — deterministic, explainable) ---

function linregSlope(y: number[]): number {
    const n = y.length;
    if (n < 2) return 0;
    const xMean = (n - 1) / 2;
    const yMean = y.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
        num += (i - xMean) * (y[i] - yMean);
        den += (i - xMean) ** 2;
    }
    return den === 0 ? 0 : num / den; // slope per month, in usage fraction
}

function ewma(y: number[], alpha: number): number {
    let e = y[0];
    for (let i = 1; i < y.length; i++) e = alpha * y[i] + (1 - alpha) * e;
    return e;
}

function volatility(y: number[]): number {
    if (y.length < 2) return 0;
    const diffs: number[] = [];
    for (let i = 1; i < y.length; i++) diffs.push(y[i] - y[i - 1]);
    const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
    const variance = diffs.reduce((s, v) => s + (v - mean) ** 2, 0) / diffs.length;
    return Math.sqrt(variance);
}

function acceleration(y: number[]): number {
    if (y.length < 3) return 0;
    const mid = Math.floor(y.length / 2);
    return linregSlope(y.slice(mid)) - linregSlope(y.slice(0, mid + 1));
}

// --- D1 access ---

export function hasDb(env: Env): boolean {
    return Boolean((env as { META_DB?: unknown }).META_DB);
}

export async function getDates(env: Env, format: string): Promise<string[]> {
    return cached(`dates:${format}`, async () => {
        const res = await env.META_DB.prepare(
            "SELECT date FROM meta_snapshot WHERE format = ? AND source = ? ORDER BY date",
        )
            .bind(format, SOURCE)
            .all();
        return ((res.results as { date: string }[]) || []).map((r) => r.date);
    });
}

export async function getBoard(env: Env, format: string, date: string): Promise<BoardRow[]> {
    return cached(`board:${format}:${date}`, async () => {
        const res = await env.META_DB.prepare(
            "SELECT pokemon_id, display_name, usage, rank, raw_count FROM usage_snapshot " +
                "WHERE format = ? AND source = ? AND date = ? ORDER BY rank",
        )
            .bind(format, SOURCE, date)
            .all<BoardRow>();
        return res.results || [];
    });
}

/** One Pokémon's monthly usage and rank between two snapshot dates (inclusive). */
export async function getUsageSeries(
    env: Env,
    format: string,
    pokemonId: string,
    from: string,
    to: string,
): Promise<{ date: string; display_name: string; usage: number; rank: number }[]> {
    const res = await env.META_DB.prepare(
        "SELECT date, display_name, usage, rank FROM usage_snapshot " +
            "WHERE format = ? AND source = ? AND pokemon_id = ? AND date BETWEEN ? AND ? " +
            "ORDER BY date",
    )
        .bind(format, SOURCE, pokemonId, from, to)
        .all<{ date: string; display_name: string; usage: number; rank: number }>();
    return res.results || [];
}

// --- Shared computations ---

export interface ShiftResult {
    risers: { name: string; delta: number; fromU: number; toU: number; toRank: number }[];
    fallers: { name: string; delta: number; fromU: number; toU: number; toRank: number }[];
    entrants: BoardRow[];
    dropouts: BoardRow[];
}

export async function computeShifts(
    env: Env,
    format: string,
    from: string,
    to: string,
    limit: number,
): Promise<ShiftResult> {
    const [fromBoard, toBoard] = await Promise.all([
        getBoard(env, format, from),
        getBoard(env, format, to),
    ]);
    const fromMap = new Map(fromBoard.map((r) => [r.pokemon_id, r]));
    const toMap = new Map(toBoard.map((r) => [r.pokemon_id, r]));

    const movers: ShiftResult["risers"] = [];
    for (const [id, t] of toMap) {
        const f = fromMap.get(id);
        if (f) {
            movers.push({
                name: t.display_name,
                delta: t.usage - f.usage,
                fromU: f.usage,
                toU: t.usage,
                toRank: t.rank,
            });
        }
    }

    return {
        risers: movers
            .filter((m) => m.delta > 0)
            .sort((a, b) => b.delta - a.delta)
            .slice(0, limit),
        fallers: movers
            .filter((m) => m.delta < 0)
            .sort((a, b) => a.delta - b.delta)
            .slice(0, limit),
        entrants: toBoard
            .filter((r) => !fromMap.has(r.pokemon_id) && r.usage >= ENTRY_THRESHOLD)
            .sort((a, b) => b.usage - a.usage)
            .slice(0, limit),
        dropouts: fromBoard
            .filter((r) => !toMap.has(r.pokemon_id) && r.usage >= ENTRY_THRESHOLD)
            .sort((a, b) => b.usage - a.usage)
            .slice(0, limit),
    };
}

export async function computeMomentum(
    env: Env,
    format: string,
    from: string,
    to: string,
): Promise<MoverMetric[]> {
    const res = await env.META_DB.prepare(
        "SELECT date, pokemon_id, display_name, usage FROM usage_snapshot " +
            "WHERE format = ? AND source = ? AND date BETWEEN ? AND ? ORDER BY pokemon_id, date",
    )
        .bind(format, SOURCE, from, to)
        .all();
    const rows =
        (res.results as { pokemon_id: string; display_name: string; usage: number }[]) || [];

    const series = new Map<string, { name: string; usages: number[] }>();
    for (const r of rows) {
        let s = series.get(r.pokemon_id);
        if (!s) {
            s = { name: r.display_name, usages: [] };
            series.set(r.pokemon_id, s);
        }
        s.usages.push(r.usage);
    }

    const metrics: MoverMetric[] = [];
    for (const s of series.values()) {
        const { usages } = s;
        if (usages.length < MIN_MOMENTUM_HISTORY) continue;
        const latest = usages[usages.length - 1];
        const earliest = usages[0];
        if (latest < MOMENTUM_RELEVANCE && earliest < MOMENTUM_RELEVANCE) continue;
        metrics.push({
            name: s.name,
            latest,
            delta: latest - earliest,
            slope: linregSlope(usages),
            ewma: ewma(usages, 0.5),
            volatility: volatility(usages),
            acceleration: acceleration(usages),
        });
    }
    return metrics;
}
