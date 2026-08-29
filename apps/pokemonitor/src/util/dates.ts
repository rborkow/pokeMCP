import type { DateWindow } from "../types";

/**
 * Build a UTC day window for a report.
 *
 * @param day Optional "YYYY-MM-DD". Defaults to *yesterday* (UTC) — the last
 *            full day for which data is complete when the cron fires at 08:00Z.
 */
export function dayWindow(day?: string): DateWindow {
    const start = day ? new Date(`${day}T00:00:00Z`) : startOfUtcDay(daysAgo(1));
    if (Number.isNaN(start.getTime())) {
        throw new Error(`Invalid report day: ${day}`);
    }
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return {
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        day: isoDay(start),
    };
}

function daysAgo(n: number): Date {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function startOfUtcDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** "YYYY-MM-DD" in UTC. */
export function isoDay(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** Analytics Engine SQL DateTime literal: "YYYY-MM-DD HH:MM:SS" (UTC). */
export function sqlDateTime(iso: string): string {
    return iso.slice(0, 19).replace("T", " ");
}

/** Start ISO of the day N days before the window start (for trend queries). */
export function trendStartIso(window: DateWindow, days: number): string {
    const start = new Date(window.startIso);
    return new Date(start.getTime() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();
}
