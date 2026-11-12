"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminData } from "./useAdminData";

interface UsageBucket {
    bucket: string;
    event_type: string;
    count: number;
}

interface UsageData {
    data: UsageBucket[];
}

export function UsageChart({ range }: { range: string }) {
    const interval = range === "1h" || range === "24h" ? "hour" : "day";
    const { data, loading, error } = useAdminData<UsageData>(`usage?interval=${interval}`, range);

    if (error) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-sm text-destructive">
                    Failed to load usage data: {error}
                </CardContent>
            </Card>
        );
    }

    // Group data by bucket timestamp
    const buckets = new Map<string, { tool_call: number; session: number }>();

    if (data?.data) {
        for (const row of data.data) {
            const key = row.bucket;
            if (!buckets.has(key)) {
                buckets.set(key, { tool_call: 0, session: 0 });
            }
            const bucket = buckets.get(key)!;
            if (row.event_type === "tool_call") bucket.tool_call = Number(row.count) || 0;
            else if (row.event_type === "session") bucket.session = Number(row.count) || 0;
        }
    }

    const sortedBuckets = Array.from(buckets.entries()).sort(
        ([a], [b]) => new Date(a).getTime() - new Date(b).getTime(),
    );

    // Find max value for scaling
    const maxValue = Math.max(1, ...sortedBuckets.map(([, v]) => Math.max(v.tool_call, v.session)));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Usage over time</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex h-48 items-center justify-center text-muted-foreground">
                        Loading...
                    </div>
                ) : sortedBuckets.length === 0 ? (
                    <div className="flex h-48 items-center justify-center text-muted-foreground">
                        No data for this time range
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Simple bar chart */}
                        <div className="flex items-end gap-1 h-48">
                            {sortedBuckets.map(([bucket, counts]) => {
                                const toolHeight = (counts.tool_call / maxValue) * 100;
                                const sessionHeight = (counts.session / maxValue) * 100;
                                const date = new Date(bucket);
                                const label =
                                    interval === "hour"
                                        ? `${date.getHours()}:00`
                                        : `${date.getMonth() + 1}/${date.getDate()}`;

                                return (
                                    <div
                                        key={bucket}
                                        className="flex flex-1 flex-col items-center gap-0.5 min-w-0"
                                        title={`${label}\nTool calls: ${counts.tool_call}\nConnections: ${counts.session}`}
                                    >
                                        <div className="flex w-full flex-col items-center gap-0.5 flex-1 justify-end">
                                            <div
                                                className="w-full max-w-3 rounded-t bg-primary/70 transition-all"
                                                style={{
                                                    height: `${toolHeight}%`,
                                                    minHeight: counts.tool_call > 0 ? "2px" : "0",
                                                }}
                                            />
                                            <div
                                                className="w-full max-w-3 rounded-t bg-orange-500/70 transition-all"
                                                style={{
                                                    height: `${sessionHeight}%`,
                                                    minHeight: counts.session > 0 ? "2px" : "0",
                                                }}
                                            />
                                        </div>
                                        {sortedBuckets.length <= 24 && (
                                            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                                                {label}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-sm bg-primary/70" />
                                Tool calls
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-sm bg-orange-500/70" />
                                Connections
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
