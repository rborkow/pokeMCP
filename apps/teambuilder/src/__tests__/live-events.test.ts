import { describe, expect, it } from "vitest";
import { newsroomFreshness } from "@/lib/live-events";

const NOW = Date.parse("2026-11-12T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

describe("newsroomFreshness", () => {
    it("is fresh when the daily job succeeded recently, even with no new events for days", () => {
        const result = newsroomFreshness(hoursAgo(6), hoursAgo(24 * 5), NOW);
        expect(result).toEqual({ checkedAt: hoursAgo(6), stale: false });
    });

    it("is delayed when the job has not succeeded for more than two days", () => {
        // A recently fetched event does not hide a job that has stopped succeeding.
        expect(newsroomFreshness(hoursAgo(49), hoursAgo(1), NOW).stale).toBe(true);
        expect(newsroomFreshness(hoursAgo(47), hoursAgo(1), NOW).stale).toBe(false);
    });

    it("falls back to the newest event's fetch time when there is no job history", () => {
        expect(newsroomFreshness(null, hoursAgo(3), NOW)).toEqual({
            checkedAt: hoursAgo(3),
            stale: false,
        });
        expect(newsroomFreshness(null, hoursAgo(72), NOW).stale).toBe(true);
    });

    it("is delayed when nothing is known", () => {
        expect(newsroomFreshness(null, null, NOW)).toEqual({ checkedAt: null, stale: true });
    });
});
