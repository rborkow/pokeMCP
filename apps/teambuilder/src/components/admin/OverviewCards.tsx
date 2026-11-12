"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMs, formatNumber, formatPercent, toNumber } from "./format";
import { useAdminData } from "./useAdminData";

interface OverviewData {
    toolCalls: { total?: number; successes?: number; avg_response_ms?: number };
    sessions: { connections?: number };
    requests: {
        total?: number;
        errors?: number;
        rate_limited?: number;
        avg_ms?: number;
        p50_ms?: number;
        p95_ms?: number;
    };
}

export function OverviewCards({ range }: { range: string }) {
    const { data, loading, error } = useAdminData<OverviewData>("overview", range);

    if (error) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-sm text-destructive">
                    Failed to load overview: {error}
                </CardContent>
            </Card>
        );
    }

    const calls = toNumber(data?.toolCalls?.total);
    const requests = toNumber(data?.requests?.total);
    const errors = toNumber(data?.requests?.errors);
    const rateLimited = toNumber(data?.requests?.rate_limited);

    const cards = [
        {
            title: "Connections",
            value: formatNumber(data?.sessions?.connections),
            subtitle: "times an assistant connected",
        },
        {
            title: "Tool calls",
            value: formatNumber(calls),
            subtitle:
                calls > 0
                    ? `${formatPercent(data?.toolCalls?.successes, calls)} returned a result`
                    : "None in this range",
        },
        {
            title: "Response time",
            value: formatMs(data?.requests?.p50_ms ?? data?.requests?.avg_ms),
            subtitle:
                data?.requests?.p95_ms !== undefined
                    ? `typical; slowest 5% above ${formatMs(data.requests.p95_ms)}`
                    : requests > 0
                      ? "average per request"
                      : "No requests in this range",
        },
        {
            title: "Failed requests",
            value: formatNumber(errors),
            subtitle:
                requests > 0
                    ? `${formatPercent(errors, requests)} of ${formatNumber(requests)}${
                          rateLimited > 0 ? `, ${formatNumber(rateLimited)} rate-limited` : ""
                      }`
                    : "No requests in this range",
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {cards.map((card) => (
                <Card key={card.title}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {card.title}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            className={`text-2xl font-bold ${loading ? "animate-pulse text-muted-foreground" : ""}`}
                        >
                            {loading ? "..." : card.value}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {loading ? "" : card.subtitle}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
