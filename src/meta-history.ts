/**
 * Metagame evolution over time (D1 time-series).
 *
 * The D1 analogue of src/stats.ts. KV (POKEMON_STATS) stays the source of truth
 * for the *current* month; this module reads the META_DB history written by the
 * backfill/append scripts and powers the `get_meta_trends` MCP tool.
 *
 * All four modes return markdown strings (like the existing stats tools) and
 * resolve formats through resolveStatsFormat() so Champions regulations and
 * Showdown ids behave consistently.
 *
 * NOTE: VGC regulations are time-boxed (regh -> regi -> regf ...), so a single
 * VGC format id only has history for the months that regulation was active.
 * Continuous formats like gen9doublesou (and singles) give unbroken series.
 */
import { toID } from "./data-loader.js";
import { getLatestStatsRegulation } from "./regulations/registry.js";
import { resolveStatsFormat } from "./regulations/stats-mapping.js";

// --- Config & cache ---

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (mirrors stats.ts)
const cache = new Map<string, { data: unknown; timestamp: number }>();

const SOURCE = "smogon-chaos";
// Champions replaced mainline VGC as the flagship ladder in 2026; default to
// the newest regulation with published Smogon stats so new regs take over
// automatically once their stats mapping is flipped on.
const DEFAULT_FORMAT = getLatestStatsRegulation()?.id ?? "gen9doublesou";
const MIN_MOMENTUM_HISTORY = 4; // need >= 4 points before flagging momentum
const ENTRY_THRESHOLD = 0.02; // 2% usage to count as a meaningful entrant/dropout
const MOMENTUM_RELEVANCE = 0.02; // only track momentum for mons reaching ~2% usage

// --- Types ---

export interface MetaTrendsArgs {
    type: "usage_trend" | "shifts" | "momentum" | "evolution_summary";
    pokemon?: string;
    format?: string;
    from?: string;
    to?: string;
    window?: number;
    limit?: number;
}

interface BoardRow {
    pokemon_id: string;
    display_name: string;
    usage: number;
    rank: number;
    raw_count: number | null;
}

interface SnapshotHeaderRow {
    date: string;
    num_battles: number | null;
    total_pokemon: number | null;
}

interface MoverMetric {
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

const pct = (fraction: number): string => `${(fraction * 100).toFixed(2)}%`;
const signedPts = (deltaFraction: number): string => {
    const v = deltaFraction * 100;
    return `${v >= 0 ? "+" : ""}${v.toFixed(2)} pts`;
};
const signedInt = (n: number): string => `${n >= 0 ? "+" : ""}${n.toLocaleString()}`;

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

function resolveRange(
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

function resolveFormat(requested?: string): {
    dbId: string;
    displayId: string;
    early: string | null;
} {
    const input = requested || DEFAULT_FORMAT;
    const resolved = resolveStatsFormat(input);
    if (resolved.championsUnmapped) {
        return {
            dbId: input,
            displayId: input,
            early:
                `No metagame history for "${input}" yet. ` +
                "Pokémon Champions usage stats are not published on Smogon, so there is " +
                "no time series to analyze.",
        };
    }
    return { dbId: resolved.resolvedId, displayId: resolved.originalId, early: null };
}

function noHistory(displayId: string): string {
    return (
        `Metagame history is not yet available for "${displayId}". ` +
        "Run `bun run backfill-history` to load Smogon archives, or wait for the next " +
        "monthly snapshot."
    );
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

function hasDb(env: Env): boolean {
    return Boolean((env as { META_DB?: unknown }).META_DB);
}

async function getDates(env: Env, format: string): Promise<string[]> {
    return cached(`dates:${format}`, async () => {
        const res = await env.META_DB.prepare(
            "SELECT date FROM meta_snapshot WHERE format = ? AND source = ? ORDER BY date",
        )
            .bind(format, SOURCE)
            .all();
        return ((res.results as { date: string }[]) || []).map((r) => r.date);
    });
}

async function getBoard(env: Env, format: string, date: string): Promise<BoardRow[]> {
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

async function getHeaders(
    env: Env,
    format: string,
    from: string,
    to: string,
): Promise<{ from?: SnapshotHeaderRow; to?: SnapshotHeaderRow }> {
    const res = await env.META_DB.prepare(
        "SELECT date, num_battles, total_pokemon FROM meta_snapshot " +
            "WHERE format = ? AND source = ? AND date IN (?, ?)",
    )
        .bind(format, SOURCE, from, to)
        .all<SnapshotHeaderRow>();
    const rows = res.results || [];
    return {
        from: rows.find((r) => r.date === from),
        to: rows.find((r) => r.date === to),
    };
}

// --- Shared computations ---

interface ShiftResult {
    risers: { name: string; delta: number; fromU: number; toU: number; toRank: number }[];
    fallers: { name: string; delta: number; fromU: number; toU: number; toRank: number }[];
    entrants: BoardRow[];
    dropouts: BoardRow[];
}

async function computeShifts(
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

async function computeMomentum(
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

// --- Modes ---

async function usageTrend(
    env: Env,
    dbId: string,
    displayId: string,
    args: MetaTrendsArgs,
): Promise<string> {
    if (!args.pokemon) return "usage_trend requires a `pokemon` argument.";
    const dates = await getDates(env, dbId);
    if (dates.length === 0) return noHistory(displayId);

    const { from, to, inRange } = resolveRange(dates, args, 12);
    const id = toID(args.pokemon);
    const res = await env.META_DB.prepare(
        "SELECT date, usage, rank FROM usage_snapshot " +
            "WHERE format = ? AND source = ? AND pokemon_id = ? AND date BETWEEN ? AND ? " +
            "ORDER BY date",
    )
        .bind(dbId, SOURCE, id, from, to)
        .all();
    const rows = (res.results as { date: string; usage: number; rank: number }[]) || [];
    if (rows.length === 0) {
        return `No usage history for ${args.pokemon} in ${displayId.toUpperCase()} between ${from} and ${to}.`;
    }

    let out = `**${args.pokemon} usage trend — ${displayId.toUpperCase()}** (${from} → ${to})\n\n`;
    out += "| Month | Usage | Rank |\n|---|---|---|\n";
    for (const r of rows) out += `| ${r.date} | ${pct(r.usage)} | #${r.rank} |\n`;

    const first = rows[0];
    const last = rows[rows.length - 1];
    const peak = rows.reduce((p, c) => (c.usage > p.usage ? c : p), rows[0]);
    out += `\n**Net change:** ${signedPts(last.usage - first.usage)} (${pct(first.usage)} → ${pct(last.usage)})\n`;
    out += `**Peak:** ${pct(peak.usage)} in ${peak.date}\n`;
    out += `**Months with data:** ${rows.length} of ${inRange.length} in range\n`;
    return out;
}

async function shiftsMode(
    env: Env,
    dbId: string,
    displayId: string,
    args: MetaTrendsArgs,
): Promise<string> {
    const dates = await getDates(env, dbId);
    if (dates.length === 0) return noHistory(displayId);
    if (dates.length < 2) {
        return `Only one snapshot (${dates[0]}) on record for ${displayId.toUpperCase()}; need two dates to compare shifts.`;
    }

    const { from, to } = resolveRange(dates, args, 3);
    if (from === to) {
        return `Could not find two distinct snapshots to compare for ${displayId.toUpperCase()}.`;
    }
    const limit = args.limit && args.limit > 0 ? args.limit : 10;
    const { risers, fallers, entrants, dropouts } = await computeShifts(env, dbId, from, to, limit);

    let out = `# Metagame shifts — ${displayId.toUpperCase()} (${from} → ${to})\n\n`;

    out += "## ▲ Risers\n";
    out += risers.length
        ? risers
              .map(
                  (m) =>
                      `- **${m.name}**: ${signedPts(m.delta)} (${pct(m.fromU)} → ${pct(m.toU)}), now #${m.toRank}`,
              )
              .join("\n")
        : "_none_";
    out += "\n\n";

    out += "## ▼ Fallers\n";
    out += fallers.length
        ? fallers
              .map(
                  (m) => `- **${m.name}**: ${signedPts(m.delta)} (${pct(m.fromU)} → ${pct(m.toU)})`,
              )
              .join("\n")
        : "_none_";
    out += "\n\n";

    out += `## ✦ New entrants (≥${pct(ENTRY_THRESHOLD)})\n`;
    out += entrants.length
        ? entrants.map((r) => `- **${r.display_name}**: ${pct(r.usage)} (#${r.rank})`).join("\n")
        : "_none_";
    out += "\n\n";

    out += `## ✕ Dropouts (were ≥${pct(ENTRY_THRESHOLD)})\n`;
    out += dropouts.length
        ? dropouts.map((r) => `- **${r.display_name}**: was ${pct(r.usage)}`).join("\n")
        : "_none_";
    out += "\n";
    return out;
}

async function momentumMode(
    env: Env,
    dbId: string,
    displayId: string,
    args: MetaTrendsArgs,
): Promise<string> {
    const dates = await getDates(env, dbId);
    if (dates.length === 0) return noHistory(displayId);
    if (dates.length < MIN_MOMENTUM_HISTORY) {
        return `Momentum needs at least ${MIN_MOMENTUM_HISTORY} monthly snapshots for ${displayId.toUpperCase()} (have ${dates.length}). Backfill more history first.`;
    }

    const { from, to, inRange } = resolveRange(dates, args, 6);
    if (inRange.length < MIN_MOMENTUM_HISTORY) {
        return `Need at least ${MIN_MOMENTUM_HISTORY} snapshots in range for ${displayId.toUpperCase()} (have ${inRange.length}); widen the window.`;
    }
    const limit = args.limit && args.limit > 0 ? args.limit : 10;
    const metrics = await computeMomentum(env, dbId, from, to);

    const rising = metrics
        .filter((m) => m.slope > 0)
        .sort((a, b) => b.slope - a.slope)
        .slice(0, limit);
    const falling = metrics
        .filter((m) => m.slope < 0)
        .sort((a, b) => a.slope - b.slope)
        .slice(0, limit);
    const volatile = [...metrics].sort((a, b) => b.volatility - a.volatility).slice(0, limit);

    const slopeStr = (m: MoverMetric) =>
        `${m.slope >= 0 ? "+" : ""}${(m.slope * 100).toFixed(2)} pts/mo`;
    const accelNote = (m: MoverMetric) => (m.acceleration > 0 ? " ⏫ accelerating" : "");

    let out = `# Metagame momentum — ${displayId.toUpperCase()} (${from} → ${to}, ${inRange.length} snapshots)\n\n`;
    out +=
        "_Descriptive momentum extrapolated from monthly usage — a signal, not a guaranteed forecast._\n\n";

    out += "## ▲ Rising (steepest positive trend)\n";
    out += rising.length
        ? rising
              .map(
                  (m) =>
                      `- **${m.name}**: ${slopeStr(m)}, now ${pct(m.latest)} (EWMA ${pct(m.ewma)})${accelNote(m)}`,
              )
              .join("\n")
        : "_none_";
    out += "\n\n";

    out += "## ▼ Declining\n";
    out += falling.length
        ? falling.map((m) => `- **${m.name}**: ${slopeStr(m)}, now ${pct(m.latest)}`).join("\n")
        : "_none_";
    out += "\n\n";

    out += "## 〰 Most volatile (unstable usage)\n";
    out += volatile.length
        ? volatile
              .map(
                  (m) =>
                      `- **${m.name}**: ±${(m.volatility * 100).toFixed(2)} pts/mo, now ${pct(m.latest)}`,
              )
              .join("\n")
        : "_none_";
    out += "\n";
    return out;
}

async function evolutionSummary(
    env: Env,
    dbId: string,
    displayId: string,
    args: MetaTrendsArgs,
): Promise<string> {
    const dates = await getDates(env, dbId);
    if (dates.length === 0) return noHistory(displayId);

    const { from, to, inRange } = resolveRange(dates, args, 6);
    const headers = await getHeaders(env, dbId, from, to);
    const latestBoard = await getBoard(env, dbId, to);

    let out = `# Metagame evolution — ${displayId.toUpperCase()}\n\n`;
    out += `**Window:** ${from} → ${to} (${inRange.length} snapshots; ${dates.length} on record)\n`;
    if (headers.from?.num_battles && headers.to?.num_battles) {
        out += `**Battles/month:** ${headers.from.num_battles.toLocaleString()} → ${headers.to.num_battles.toLocaleString()} (${signedInt(headers.to.num_battles - headers.from.num_battles)})\n`;
    }
    out += "\n";

    const topN = Math.min(10, latestBoard.length);
    out += `## Current top ${topN} (${to})\n`;
    latestBoard.slice(0, topN).forEach((r, i) => {
        out += `${i + 1}. ${r.display_name} — ${pct(r.usage)}\n`;
    });
    out += "\n";

    if (from !== to) {
        const sh = await computeShifts(env, dbId, from, to, 5);
        out += `## Biggest movers (${from} → ${to})\n`;
        out += `**Rising:** ${sh.risers.map((m) => `${m.name} (${signedPts(m.delta)})`).join(", ") || "—"}\n\n`;
        out += `**Falling:** ${sh.fallers.map((m) => `${m.name} (${signedPts(m.delta)})`).join(", ") || "—"}\n\n`;
        if (sh.entrants.length) {
            out += `**New:** ${sh.entrants.map((r) => `${r.display_name} (${pct(r.usage)})`).join(", ")}\n\n`;
        }
    }

    if (inRange.length >= MIN_MOMENTUM_HISTORY) {
        const rising = (await computeMomentum(env, dbId, from, to))
            .filter((m) => m.slope > 0)
            .sort((a, b) => b.slope - a.slope)
            .slice(0, 5);
        if (rising.length) {
            out += "## Momentum — accelerating usage\n";
            for (const m of rising) {
                out += `- ${m.name}: ${m.slope >= 0 ? "+" : ""}${(m.slope * 100).toFixed(2)} pts/mo, now ${pct(m.latest)}\n`;
            }
            out += "\n";
        }
    }

    out += "_Trends are descriptive/extrapolated from monthly usage, not guaranteed forecasts._\n";
    return out;
}

// --- Tool entry point ---

/**
 * get_meta_trends: usage_trend | shifts | momentum | evolution_summary.
 * Reads the META_DB time series populated by the backfill/append scripts.
 */
export async function getMetaTrends(args: MetaTrendsArgs, env: Env): Promise<string> {
    if (!hasDb(env)) {
        return "Metagame history is not configured (D1 binding META_DB is unavailable).";
    }
    const { dbId, displayId, early } = resolveFormat(args.format);
    if (early) return early;

    try {
        switch (args.type) {
            case "usage_trend":
                return await usageTrend(env, dbId, displayId, args);
            case "shifts":
                return await shiftsMode(env, dbId, displayId, args);
            case "momentum":
                return await momentumMode(env, dbId, displayId, args);
            case "evolution_summary":
                return await evolutionSummary(env, dbId, displayId, args);
            default:
                return `Unknown trend type: ${args.type}`;
        }
    } catch (e) {
        console.error(`get_meta_trends error (${args.type}, ${dbId}):`, e);
        return `Error computing metagame trends for ${displayId}. The history store may still be populating.`;
    }
}
