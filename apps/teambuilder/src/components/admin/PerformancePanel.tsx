"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMs, formatNumber, toNumber } from "./format";
import { useAdminData } from "./useAdminData";

interface PerformanceData {
    requests: Array<{
        kind: string;
        requests: number;
        errors: number;
        avg_ms: number;
        p50_ms?: number;
        p95_ms?: number;
    }>;
    statuses: Array<{ status: string; requests: number }>;
    percentilesError?: string;
}

const KIND_LABELS: Record<string, string> = {
    initialize: "Connect (initialize)",
    "tools/list": "List tools",
    "tools/call": "Call a tool",
    notification: "Notification",
    ping: "Ping",
    batch: "Batch",
    other: "Other method",
    invalid: "Not valid JSON",
    http_get: "GET (not supported)",
    http_delete: "DELETE (not supported)",
    rate_limited: "Turned away by rate limit",
};

export function PerformancePanel({ range }: { range: string }) {
    const { data, loading, error } = useAdminData<PerformanceData>("performance", range);

    if (error) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-sm text-destructive">
                    Failed to load performance: {error}
                </CardContent>
            </Card>
        );
    }

    const hasPercentiles = data?.requests?.some((row) => row.p95_ms !== undefined) ?? false;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Requests and response times</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                        Loading...
                    </div>
                ) : !data?.requests?.length ? (
                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                        No requests in this range
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-xs text-muted-foreground">
                                        <th className="pb-2 font-medium">Request</th>
                                        <th className="pb-2 text-right font-medium">Count</th>
                                        <th className="pb-2 text-right font-medium">Failed</th>
                                        <th className="pb-2 text-right font-medium">
                                            {hasPercentiles ? "Typical" : "Average"}
                                        </th>
                                        {hasPercentiles && (
                                            <th className="pb-2 text-right font-medium">
                                                Slowest 5%
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.requests.map((row) => (
                                        <tr key={row.kind} className="border-b border-border/30">
                                            <td className="py-2">
                                                {KIND_LABELS[row.kind] ?? row.kind}
                                            </td>
                                            <td className="py-2 text-right tabular-nums">
                                                {formatNumber(row.requests)}
                                            </td>
                                            <td
                                                className={`py-2 text-right tabular-nums ${
                                                    toNumber(row.errors) > 0
                                                        ? "text-destructive"
                                                        : "text-muted-foreground"
                                                }`}
                                            >
                                                {formatNumber(row.errors)}
                                            </td>
                                            <td className="py-2 text-right tabular-nums">
                                                {formatMs(hasPercentiles ? row.p50_ms : row.avg_ms)}
                                            </td>
                                            {hasPercentiles && (
                                                <td className="py-2 text-right tabular-nums text-muted-foreground">
                                                    {formatMs(row.p95_ms)}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Time spent inside the server, per request. It leaves out network time to
                            and from the assistant.{" "}
                            {data.statuses?.length
                                ? `By HTTP status: ${data.statuses
                                      .map((row) => `${row.status} × ${formatNumber(row.requests)}`)
                                      .join(", ")}.`
                                : ""}
                        </p>
                        {data.percentilesError && (
                            <p className="text-xs text-muted-foreground">
                                Percentiles are unavailable, so averages are shown (
                                {data.percentilesError}).
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
