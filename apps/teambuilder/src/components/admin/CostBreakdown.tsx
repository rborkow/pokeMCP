"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminData } from "./useAdminData";

interface CostData {
    daily: Array<{
        day: string;
        requests: number;
        input_tokens: number;
        output_tokens: number;
        cache_creation_tokens: number;
        cache_read_tokens: number;
        cost_usd: number;
    }>;
    byFormat: Array<{
        format: string;
        requests: number;
        cost_usd: number;
    }>;
    byPersonality: Array<{
        personality: string;
        requests: number;
        cost_usd: number;
    }>;
    cacheHitRate: number;
}

function formatCost(n: number): string {
    if (n < 0.01) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(2)}`;
}

export function CostBreakdown({ range }: { range: string }) {
    const { data, loading, error } = useAdminData<CostData>("costs", range);

    if (error) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-sm text-destructive">
                    Failed to load cost data: {error}
                </CardContent>
            </Card>
        );
    }

    const totalCost = data?.daily?.reduce((sum, d) => sum + (d.cost_usd || 0), 0) ?? 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">AI Costs</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                        Loading...
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Total cost */}
                        <div className="flex items-baseline justify-between">
                            <span className="text-sm text-muted-foreground">Total</span>
                            <span className="text-xl font-bold">{formatCost(totalCost)}</span>
                        </div>

                        {/* Cache hit rate */}
                        <div className="flex items-baseline justify-between">
                            <span className="text-sm text-muted-foreground">Cache Hit Rate</span>
                            <span className="text-sm font-medium">
                                {((data?.cacheHitRate ?? 0) * 100).toFixed(1)}%
                            </span>
                        </div>

                        {/* Cost by format */}
                        {data?.byFormat && data.byFormat.length > 0 && (
                            <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                                    By Format
                                </h4>
                                <div className="space-y-1.5">
                                    {data.byFormat.slice(0, 5).map((f) => (
                                        <div
                                            key={f.format}
                                            className="flex items-center justify-between text-sm"
                                        >
                                            <span className="font-mono text-xs">
                                                {f.format || "unknown"}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {formatCost(f.cost_usd)} ({f.requests} req)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Cost by personality */}
                        {data?.byPersonality && data.byPersonality.length > 0 && (
                            <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                                    By Personality
                                </h4>
                                <div className="space-y-1.5">
                                    {data.byPersonality.map((p) => (
                                        <div
                                            key={p.personality}
                                            className="flex items-center justify-between text-sm"
                                        >
                                            <span className="capitalize">
                                                {p.personality || "unknown"}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {formatCost(p.cost_usd)} ({p.requests} req)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!data?.byFormat?.length && !data?.byPersonality?.length && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No cost data for this range
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
