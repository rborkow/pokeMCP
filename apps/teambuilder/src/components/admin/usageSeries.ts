import { toNumber } from "./format";

export type Interval = "hour" | "day";

export interface UsageRow {
    bucket: string;
    event_type: string;
    count: number | string;
}

export interface UsagePoint {
    /** Bucket start, epoch milliseconds (UTC). */
    time: number;
    toolCalls: number;
    connections: number;
}

const STEP_MS: Record<Interval, number> = { hour: 3_600_000, day: 86_400_000 };

const RANGE_MS: Record<string, number> = {
    "1h": 3_600_000,
    "24h": 86_400_000,
    "7d": 7 * 86_400_000,
    "30d": 30 * 86_400_000,
};

// Never draw more slots than this, whatever the data says.
const MAX_SLOTS = 400;

export function intervalForRange(range: string): Interval {
    return range === "1h" || range === "24h" ? "hour" : "day";
}

/**
 * Analytics Engine returns buckets as "2026-11-12 20:00:00" in UTC, with no
 * zone. `new Date()` reads that as local time (and Safari refuses it), so the
 * zone is added explicitly.
 */
export function parseBucket(bucket: string): number {
    const trimmed = String(bucket).trim();
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
    const iso = trimmed.replace(" ", "T") + (hasZone ? "" : "Z");
    return new Date(iso).getTime();
}

/**
 * One point per bucket across the whole range, with empty buckets as zero, so
 * the time axis is even and a quiet hour shows as a gap rather than vanishing.
 */
export function buildUsageSeries(
    rows: UsageRow[],
    interval: Interval,
    range: string,
    now: number = Date.now(),
): UsagePoint[] {
    const step = STEP_MS[interval];
    const counts = new Map<number, UsagePoint>();

    for (const row of rows) {
        const time = parseBucket(row.bucket);
        if (!Number.isFinite(time)) continue;
        const slot = Math.floor(time / step) * step;
        const point = counts.get(slot) ?? { time: slot, toolCalls: 0, connections: 0 };
        if (row.event_type === "tool_call") point.toolCalls += toNumber(row.count);
        else if (row.event_type === "session") point.connections += toNumber(row.count);
        counts.set(slot, point);
    }

    const rangeMs = RANGE_MS[range] ?? RANGE_MS["24h"];
    let start = Math.floor((now - rangeMs) / step) * step;
    let end = Math.floor(now / step) * step;
    for (const slot of counts.keys()) {
        if (slot < start) start = slot;
        if (slot > end) end = slot;
    }
    if ((end - start) / step + 1 > MAX_SLOTS) start = end - (MAX_SLOTS - 1) * step;

    const points: UsagePoint[] = [];
    for (let t = start; t <= end; t += step) {
        points.push(counts.get(t) ?? { time: t, toolCalls: 0, connections: 0 });
    }
    return points;
}

/** A round axis maximum and step: 1, 2, 2.5 (from 25 up) or 5 times a power of ten. */
export function niceScale(max: number, targetTicks = 4): { max: number; step: number } {
    if (max <= 0) return { max: 4, step: 1 };
    const raw = max / targetTicks;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const residual = raw / magnitude;
    const quarter = magnitude >= 10 && residual <= 2.5 ? 2.5 : 5;
    const nice = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? quarter : 10;
    const step = Math.max(1, nice * magnitude);
    return { max: Math.ceil(max / step) * step, step };
}
