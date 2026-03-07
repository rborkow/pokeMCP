"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminData } from "./useAdminData";

interface OverviewData {
    toolCalls: {
        total: number;
        successes: number;
        avg_response_ms: number;
        p95_response_ms: number;
    };
    aiChat: {
        total: number;
        total_input_tokens: number;
        total_output_tokens: number;
        total_cost_usd: number;
        avg_response_ms: number;
    };
    sessions: {
        connections: number;
    };
}

function formatNumber(n: number | undefined): string {
    if (n === undefined || n === null) return "0";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return Math.round(n).toLocaleString();
}

function formatCost(n: number | undefined): string {
    if (n === undefined || n === null) return "$0.00";
    return `$${n.toFixed(2)}`;
}

function formatMs(n: number | undefined): string {
    if (n === undefined || n === null) return "0ms";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
    return `${Math.round(n)}ms`;
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

    const cards = [
        {
            title: "Tool Calls",
            value: formatNumber(data?.toolCalls?.total),
            subtitle: data?.toolCalls?.total
                ? `${(((data.toolCalls.successes ?? 0) / data.toolCalls.total) * 100).toFixed(1)}% success`
                : "No data",
        },
        {
            title: "AI Chats",
            value: formatNumber(data?.aiChat?.total),
            subtitle: data?.aiChat?.avg_response_ms
                ? `avg ${formatMs(data.aiChat.avg_response_ms)}`
                : "No data",
        },
        {
            title: "AI Cost",
            value: formatCost(data?.aiChat?.total_cost_usd),
            subtitle: data?.aiChat?.total_input_tokens
                ? `${formatNumber(data.aiChat.total_input_tokens + data.aiChat.total_output_tokens)} tokens`
                : "No data",
        },
        {
            title: "MCP Sessions",
            value: formatNumber(data?.sessions?.connections),
            subtitle: data?.toolCalls?.p95_response_ms
                ? `p95 ${formatMs(data.toolCalls.p95_response_ms)}`
                : "No data",
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
                        <p className="text-xs text-muted-foreground mt-1">
                            {loading ? "" : card.subtitle}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
