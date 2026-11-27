/**
 * Connector tools over the monthly usage history (META_DB D1): one Pokémon's
 * trend, shifts between two months, and momentum across several months.
 */
import { toID } from "../data-loader.js";
import {
    computeMomentum,
    computeShifts,
    ENTRY_THRESHOLD,
    getDates,
    getUsageSeries,
    hasDb,
    MIN_MOMENTUM_FALLBACK,
    MIN_MOMENTUM_HISTORY,
    resolveRange,
} from "../meta-history.js";
import type { RegulationSet } from "../regulations/types.js";
import { formatFields, resolveRegulation } from "./formats.js";
import { resolvePokemon } from "./pokemon.js";
import { type Failure, fail, ok, round2, type ToolOutcome, toPercent } from "./types.js";

export interface RangeArgs {
    format?: string;
    from?: string;
    to?: string;
    months?: number;
}

type History = Failure | { ok: true; regulation: RegulationSet; statsId: string; dates: string[] };

/** Resolve the format and load the months it has history for. */
async function loadHistory(format: string | undefined, env: Env): Promise<History> {
    const regulation = resolveRegulation(format);
    if (!regulation.showdownFormatId) {
        return {
            ok: false,
            error:
                `Usage statistics for ${regulation.shortLabel} have not been published yet, ` +
                "so there is no history to analyse. Call list_formats to find a format that has them.",
            reason: "data_unavailable",
        };
    }
    if (!hasDb(env)) {
        return {
            ok: false,
            error: "Usage history is unavailable right now. Try again later.",
            reason: "data_unavailable",
        };
    }
    const dates = await getDates(env, regulation.showdownFormatId);
    if (dates.length === 0) {
        return {
            ok: false,
            error:
                `No monthly usage history is recorded for ${regulation.shortLabel} yet. ` +
                "Use get_top_usage for the current month's ranking.",
            reason: "insufficient_history",
        };
    }
    return { ok: true, regulation, statsId: regulation.showdownFormatId, dates };
}

const signed = (points: number) => `${points >= 0 ? "+" : ""}${points}`;

// --- get_usage_trend ---

export async function getUsageTrend(
    args: RangeArgs & { pokemon: string },
    env: Env,
): Promise<ToolOutcome> {
    const history = await loadHistory(args.format, env);
    if (history.ok === false) return fail(history.error, history.reason);
    const { regulation, statsId, dates } = history;

    const { from, to } = resolveRange(dates, { ...args, window: args.months }, 12);
    const rows = await getUsageSeries(env, statsId, toID(args.pokemon), from, to);
    if (rows.length === 0) {
        return fail(
            `${args.pokemon} has no recorded usage in ${regulation.shortLabel} between ${from} ` +
                `and ${to}. Check the spelling (Mega Evolutions are listed separately, for ` +
                `example "Charizard-Mega-Y"), or call get_top_usage to see which Pokémon are used.`,
            resolvePokemon(args.pokemon) ? "no_usage" : "unknown_pokemon",
        );
    }

    const points = rows.map((r) => ({
        month: r.date,
        usagePercent: toPercent(r.usage),
        rank: r.rank,
    }));
    const first = points[0];
    const last = points[points.length - 1];
    const peak = points.reduce((best, p) => (p.usagePercent > best.usagePercent ? p : best));
    const name = rows[rows.length - 1].display_name;

    const data = {
        pokemon: name,
        ...formatFields(regulation),
        from,
        to,
        points,
        netChangePoints: round2(last.usagePercent - first.usagePercent),
        peak: { month: peak.month, usagePercent: peak.usagePercent },
    };
    const text = [
        `**${name} usage — ${regulation.shortLabel}** (${from} to ${to})`,
        "",
        "| Month | Usage | Rank |",
        "|---|---|---|",
        ...points.map((p) => `| ${p.month} | ${p.usagePercent}% | #${p.rank} |`),
        "",
        `Net change: ${signed(data.netChangePoints)} percentage points. ` +
            `Peak: ${peak.usagePercent}% in ${peak.month}.`,
    ].join("\n");
    return ok(data, text);
}

// --- get_meta_shifts ---

export async function getMetaShifts(
    args: RangeArgs & { limit?: number },
    env: Env,
): Promise<ToolOutcome> {
    const history = await loadHistory(args.format, env);
    if (history.ok === false) return fail(history.error, history.reason);
    const { regulation, statsId, dates } = history;

    const { from, to } = resolveRange(dates, { ...args, window: args.months }, 3);
    if (from === to) {
        return fail(
            `Comparing months needs two snapshots, and ${regulation.shortLabel} has ` +
                `${dates.length === 1 ? `only ${dates[0]}` : "none that differ in the requested range"}. ` +
                "Use get_top_usage for the current ranking.",
            "insufficient_history",
        );
    }

    const shifts = await computeShifts(env, statsId, from, to, args.limit ?? 10);
    const mover = (m: (typeof shifts.risers)[number]) => ({
        name: m.name,
        changePoints: round2((m.toU - m.fromU) * 100),
        fromPercent: toPercent(m.fromU),
        toPercent: toPercent(m.toU),
        rank: m.toRank,
    });
    const data = {
        ...formatFields(regulation),
        from,
        to,
        risers: shifts.risers.map(mover),
        fallers: shifts.fallers.map(mover),
        newEntrants: shifts.entrants.map((r) => ({
            name: r.display_name,
            usagePercent: toPercent(r.usage),
            rank: r.rank,
        })),
        dropouts: shifts.dropouts.map((r) => ({
            name: r.display_name,
            previousUsagePercent: toPercent(r.usage),
        })),
    };

    const moverLine = (m: (typeof data.risers)[number]) =>
        `- ${m.name}: ${signed(m.changePoints)} points (${m.fromPercent}% → ${m.toPercent}%), now #${m.rank}`;
    const threshold = toPercent(ENTRY_THRESHOLD);
    const section = (title: string, lines: string[]) => [
        "",
        title,
        ...(lines.length ? lines : ["- none"]),
    ];
    const text = [
        `**Usage shifts — ${regulation.shortLabel}** (${from} to ${to})`,
        ...section("Risers:", data.risers.map(moverLine)),
        ...section("Fallers:", data.fallers.map(moverLine)),
        ...section(
            `New entrants (at least ${threshold}% usage, absent in ${from}):`,
            data.newEntrants.map((e) => `- ${e.name}: ${e.usagePercent}% (#${e.rank})`),
        ),
        ...section(
            `Dropouts (had at least ${threshold}% usage, absent in ${to}):`,
            data.dropouts.map((d) => `- ${d.name}: was ${d.previousUsagePercent}%`),
        ),
    ].join("\n");
    return ok(data, text);
}

// --- get_usage_momentum ---

export async function getUsageMomentum(
    args: RangeArgs & { limit?: number },
    env: Env,
): Promise<ToolOutcome> {
    const history = await loadHistory(args.format, env);
    if (history.ok === false) return fail(history.error, history.reason);
    const { regulation, statsId, dates } = history;

    const { from, to, inRange } = resolveRange(dates, { ...args, window: args.months }, 6);
    if (inRange.length < MIN_MOMENTUM_FALLBACK) {
        return fail(
            `Momentum needs at least ${MIN_MOMENTUM_FALLBACK} monthly snapshots, and ` +
                `${regulation.shortLabel} has ${inRange.length} between ${from} and ${to}. ` +
                "Widen the range, or use get_top_usage for the current ranking.",
            "insufficient_history",
        );
    }
    // A new regulation has two months of data for a month or so. Rather than
    // refuse, report the straight change between them and say so.
    const twoPoint = inRange.length < MIN_MOMENTUM_HISTORY;

    const limit = args.limit ?? 10;
    const metrics = await computeMomentum(
        env,
        statsId,
        from,
        to,
        twoPoint ? MIN_MOMENTUM_FALLBACK : MIN_MOMENTUM_HISTORY,
    );
    const entry = (m: (typeof metrics)[number]) => ({
        name: m.name,
        slopePointsPerMonth: round2(m.slope * 100),
        usagePercent: toPercent(m.latest),
        // Steepening in the direction of travel: a decline that is slowing
        // has positive acceleration but is not "accelerating".
        accelerating: m.slope >= 0 ? m.acceleration > 0 : m.acceleration < 0,
    });
    const note = twoPoint
        ? `Only two monthly snapshots (${from} and ${to}), so these are the straight changes ` +
          "between them, not fitted trends. Speeding up and volatility need " +
          `${MIN_MOMENTUM_HISTORY} months and are left out.`
        : undefined;
    const data = {
        ...formatFields(regulation),
        from,
        to,
        snapshots: inRange.length,
        ...(note ? { note } : {}),
        rising: metrics
            .filter((m) => m.slope > 0)
            .sort((a, b) => b.slope - a.slope)
            .slice(0, limit)
            .map(entry),
        declining: metrics
            .filter((m) => m.slope < 0)
            .sort((a, b) => a.slope - b.slope)
            .slice(0, limit)
            .map(entry),
        volatile: (twoPoint ? [] : [...metrics])
            .sort((a, b) => b.volatility - a.volatility)
            .slice(0, limit)
            .map((m) => ({
                name: m.name,
                volatilityPoints: round2(m.volatility * 100),
                usagePercent: toPercent(m.latest),
            })),
    };

    const trendLine = (m: (typeof data.rising)[number]) =>
        `- ${m.name}: ${signed(m.slopePointsPerMonth)} points/month, now ${m.usagePercent}%` +
        `${m.accelerating ? " (speeding up)" : ""}`;
    const section = (title: string, lines: string[]) => [
        "",
        title,
        ...(lines.length ? lines : ["- none"]),
    ];
    const text = [
        `**Usage momentum — ${regulation.shortLabel}** (${from} to ${to}, ${inRange.length} monthly snapshots)`,
        note ?? "Descriptive trends fitted to past monthly usage, not forecasts.",
        ...section("Rising:", data.rising.map(trendLine)),
        ...section("Declining:", data.declining.map(trendLine)),
        ...(twoPoint
            ? []
            : section(
                  "Most volatile:",
                  data.volatile.map(
                      (v) =>
                          `- ${v.name}: ±${v.volatilityPoints} points/month, now ${v.usagePercent}%`,
                  ),
              )),
    ].join("\n");
    return ok(data, text);
}
