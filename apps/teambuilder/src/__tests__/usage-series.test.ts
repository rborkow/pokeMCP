import { describe, expect, it } from "vitest";
import { buildUsageSeries, niceScale, parseBucket } from "@/components/admin/usageSeries";

const HOUR = 3_600_000;

describe("usage chart series", () => {
    it("reads Analytics Engine buckets as UTC", () => {
        expect(parseBucket("2026-11-12 20:00:00")).toBe(Date.UTC(2026, 10, 12, 20));
        expect(parseBucket("2026-11-12T20:00:00Z")).toBe(Date.UTC(2026, 10, 12, 20));
    });

    it("fills every hour of the range, with quiet hours as zero", () => {
        const now = Date.UTC(2026, 10, 12, 23, 30);
        const points = buildUsageSeries(
            [
                { bucket: "2026-11-12 20:00:00", event_type: "tool_call", count: "12" },
                { bucket: "2026-11-12 20:00:00", event_type: "session", count: 3 },
                { bucket: "2026-11-12 22:00:00", event_type: "tool_call", count: 5 },
            ],
            "hour",
            "24h",
            now,
        );
        expect(points).toHaveLength(25);
        expect(points.at(-1)?.time).toBe(Date.UTC(2026, 10, 12, 23));
        const at = (h: number) => points.find((p) => p.time === Date.UTC(2026, 10, 12, h));
        expect(at(20)).toEqual({ time: Date.UTC(2026, 10, 12, 20), toolCalls: 12, connections: 3 });
        expect(at(21)).toMatchObject({ toolCalls: 0, connections: 0 });
        expect(at(22)).toMatchObject({ toolCalls: 5 });
        expect(points[1].time - points[0].time).toBe(HOUR);
    });

    it("fills every day of a 7-day range", () => {
        const now = Date.UTC(2026, 10, 18, 12);
        const points = buildUsageSeries([], "day", "7d", now);
        expect(points).toHaveLength(8);
        expect(points[0].time).toBe(Date.UTC(2026, 10, 11));
    });

    it("rounds the axis to 1, 2, 2.5 or 5 times a power of ten", () => {
        expect(niceScale(0)).toEqual({ max: 4, step: 1 });
        expect(niceScale(7)).toEqual({ max: 8, step: 2 });
        expect(niceScale(37)).toEqual({ max: 40, step: 10 });
        expect(niceScale(1234)).toEqual({ max: 1500, step: 500 });
        expect(niceScale(900)).toEqual({ max: 1000, step: 250 });
        expect(niceScale(9)).toEqual({ max: 10, step: 5 });
    });
});
