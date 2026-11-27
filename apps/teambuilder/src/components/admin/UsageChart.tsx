"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatNumber } from "./format";
import { useAdminData } from "./useAdminData";
import {
    buildUsageSeries,
    type Interval,
    intervalForRange,
    niceScale,
    type UsagePoint,
    type UsageRow,
} from "./usageSeries";

interface UsageData {
    data: UsageRow[];
}

// Series colors live in globals.css (--viz-series-*), stepped separately for
// the dark card and for print. Both pairs pass the dataviz palette validator:
// colorblind separation ΔE ≥ 24 and ≥ 3:1 contrast against the card.
const SERIES = [
    { key: "toolCalls", label: "Tool calls", color: "var(--viz-series-1)" },
    { key: "connections", label: "Connections", color: "var(--viz-series-2)" },
] as const;

const HEIGHT = 240;
const MARGIN = { top: 12, right: 8, bottom: 28 };
const BAR_MAX = 24;
const BAR_GAP = 2;
const RADIUS = 4;
const FALLBACK_WIDTH = 720;

function axisLabel(time: number, interval: Interval): string {
    const date = new Date(time);
    if (interval === "day") {
        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
        });
    }
    // Midnight carries the date so a 24-hour window shows where the day turns.
    if (date.getHours() === 0) {
        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    return date.toLocaleTimeString(undefined, { hour: "numeric" });
}

function fullLabel(time: number, interval: Interval): string {
    const date = new Date(time);
    if (interval === "day") {
        return `${date.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
        })} (UTC)`;
    }
    return date.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
    });
}

/** A column with a 4px rounded top and a square foot on the baseline. */
function columnPath(x: number, y: number, width: number, baseline: number): string {
    const h = baseline - y;
    const r = Math.min(RADIUS, width / 2, h);
    return [
        `M${x},${baseline}`,
        `V${y + r}`,
        `Q${x},${y} ${x + r},${y}`,
        `H${x + width - r}`,
        `Q${x + width},${y} ${x + width},${y + r}`,
        `V${baseline}`,
        "Z",
    ].join(" ");
}

function useWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        setWidth(node.clientWidth);
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(node);
        return () => observer.disconnect();
    }, []);
    return [ref, width] as const;
}

export function UsageChart({ range }: { range: string }) {
    const interval = intervalForRange(range);
    const { data, loading, error } = useAdminData<UsageData>(`usage?interval=${interval}`, range);
    const [showTable, setShowTable] = useState(false);

    if (error) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-sm text-destructive">
                    Failed to load usage data: {error}
                </CardContent>
            </Card>
        );
    }

    const points = data ? buildUsageSeries(data.data ?? [], interval, range) : [];
    const totals = {
        toolCalls: points.reduce((sum, p) => sum + p.toolCalls, 0),
        connections: points.reduce((sum, p) => sum + p.connections, 0),
    };
    const empty = totals.toolCalls === 0 && totals.connections === 0;

    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                    <CardTitle className="text-base">Usage over time</CardTitle>
                    {data && !empty && (
                        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Legend">
                            {SERIES.map((s) => (
                                <li key={s.key} className="flex items-center gap-2">
                                    <span
                                        aria-hidden
                                        className="h-3 w-3 rounded-[3px]"
                                        style={{ background: s.color }}
                                    />
                                    <span className="text-muted-foreground">{s.label}</span>
                                    <span className="font-semibold text-foreground">
                                        {formatNumber(totals[s.key])}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {data && !empty && (
                    <button
                        type="button"
                        onClick={() => setShowTable((v) => !v)}
                        aria-pressed={showTable}
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                        {showTable ? "Show chart" : "Show table"}
                    </button>
                )}
            </CardHeader>
            <CardContent>
                {loading && !data ? (
                    <div className="flex h-60 items-center justify-center text-muted-foreground">
                        Loading...
                    </div>
                ) : empty ? (
                    <div className="flex h-60 items-center justify-center text-muted-foreground">
                        No data for this time range
                    </div>
                ) : (
                    <div className={cn("transition-opacity", loading && "opacity-60")}>
                        {showTable ? (
                            <UsageTable points={points} interval={interval} />
                        ) : (
                            <UsagePlot points={points} interval={interval} />
                        )}
                        <p className="mt-3 text-xs text-muted-foreground">
                            {interval === "hour"
                                ? "Each column is one hour, in your time zone."
                                : "Each column is one day, in UTC."}{" "}
                            Hover or tab through the columns for exact counts.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function UsagePlot({ points, interval }: { points: UsagePoint[]; interval: Interval }) {
    const [ref, measured] = useWidth<HTMLDivElement>();
    const [active, setActive] = useState<number | null>(null);
    const width = measured || FALLBACK_WIDTH;

    const peak = Math.max(0, ...points.map((p) => Math.max(p.toolCalls, p.connections)));
    const scale = niceScale(peak);
    const ticks: number[] = [];
    for (let v = 0; v <= scale.max; v += scale.step) ticks.push(v);

    const left = Math.max(...ticks.map((t) => formatNumber(t).length)) * 7 + 14;
    const plotW = Math.max(1, width - left - MARGIN.right);
    const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
    const baseline = MARGIN.top + plotH;
    const band = plotW / points.length;
    const barW = Math.max(1, Math.min(BAR_MAX, (band * 0.72 - BAR_GAP) / 2));
    const groupW = barW * 2 + BAR_GAP;
    const y = (v: number) => baseline - (v / scale.max) * plotH;

    // Thin the x labels so they never collide: about one per 72px.
    const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / 72))));

    const activePoint = active !== null ? points[active] : null;
    // The readout sits beside the hovered column, on whichever side has room.
    const flip = active !== null && active > points.length / 2;
    const tooltipLeft = active !== null ? left + band * (flip ? active : active + 1) : 0;

    return (
        <div ref={ref} className="relative">
            <svg
                width={width}
                height={HEIGHT}
                role="img"
                aria-label={`Tool calls and connections per ${interval}, ${points.length} ${interval}s. Peak ${formatNumber(peak)}.`}
                className="block overflow-visible"
                onPointerLeave={() => setActive(null)}
            >
                {/* Gridlines and y-axis ticks */}
                {ticks.map((t) => (
                    <g key={t}>
                        <line
                            x1={left}
                            x2={left + plotW}
                            y1={y(t)}
                            y2={y(t)}
                            stroke="var(--border)"
                            strokeWidth={1}
                            shapeRendering="crispEdges"
                        />
                        <text
                            x={left - 8}
                            y={y(t)}
                            dy="0.32em"
                            textAnchor="end"
                            className="fill-muted-foreground text-[11px] tabular-nums"
                        >
                            {formatNumber(t)}
                        </text>
                    </g>
                ))}

                {points.map((p, i) => {
                    const x0 = left + band * i + (band - groupW) / 2;
                    const isActive = active === i;
                    return (
                        <g key={p.time}>
                            {isActive && (
                                <rect
                                    x={left + band * i}
                                    y={MARGIN.top}
                                    width={band}
                                    height={plotH}
                                    fill="var(--muted-foreground)"
                                    opacity={0.12}
                                />
                            )}
                            {SERIES.map((s, si) => {
                                const value = p[s.key];
                                if (value <= 0) return null;
                                const top = Math.min(y(value), baseline - 2);
                                return (
                                    <path
                                        key={s.key}
                                        d={columnPath(
                                            x0 + si * (barW + BAR_GAP),
                                            top,
                                            barW,
                                            baseline,
                                        )}
                                        fill={s.color}
                                    />
                                );
                            })}
                            {i % every === 0 && (
                                <text
                                    x={left + band * (i + 0.5)}
                                    y={baseline + 18}
                                    textAnchor="middle"
                                    className="fill-muted-foreground text-[11px]"
                                >
                                    {axisLabel(p.time, interval)}
                                </text>
                            )}
                            {/* The hit target is the whole column band, not the bar */}
                            <rect
                                x={left + band * i}
                                y={MARGIN.top}
                                width={band}
                                height={plotH}
                                fill="transparent"
                                tabIndex={0}
                                role="button"
                                aria-label={`${fullLabel(p.time, interval)}: ${p.toolCalls} tool calls, ${p.connections} connections`}
                                onPointerEnter={() => setActive(i)}
                                onFocus={() => setActive(i)}
                                onBlur={() => setActive(null)}
                                className="outline-none"
                            />
                        </g>
                    );
                })}

                {/* Baseline */}
                <line
                    x1={left}
                    x2={left + plotW}
                    y1={baseline}
                    y2={baseline}
                    stroke="var(--muted-foreground)"
                    strokeOpacity={0.5}
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                />
            </svg>

            {activePoint && (
                <div
                    role="status"
                    className={cn(
                        "pointer-events-none absolute z-10 min-w-40 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md",
                        flip ? "-translate-x-full -ml-2" : "ml-2",
                    )}
                    style={{ left: tooltipLeft, top: MARGIN.top }}
                >
                    <div className="mb-1.5 text-muted-foreground">
                        {fullLabel(activePoint.time, interval)}
                    </div>
                    {SERIES.map((s) => (
                        <div key={s.key} className="flex items-center gap-2 py-0.5">
                            <span
                                aria-hidden
                                className="h-0.5 w-3 rounded-full"
                                style={{ background: s.color }}
                            />
                            <span className="font-semibold tabular-nums text-popover-foreground">
                                {formatNumber(activePoint[s.key])}
                            </span>
                            <span className="text-muted-foreground">{s.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function UsageTable({ points, interval }: { points: UsagePoint[]; interval: Interval }) {
    return (
        <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">{interval === "hour" ? "Hour" : "Day"}</th>
                        {SERIES.map((s) => (
                            <th key={s.key} className="pb-2 text-right font-medium">
                                {s.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {[...points].reverse().map((p) => (
                        <tr key={p.time} className="border-b border-border/30">
                            <td className="py-1.5">{fullLabel(p.time, interval)}</td>
                            {SERIES.map((s) => (
                                <td key={s.key} className="py-1.5 text-right tabular-nums">
                                    {formatNumber(p[s.key])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
