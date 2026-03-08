"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminData } from "./useAdminData";

interface SessionsData {
    sessions: Array<{
        session_id: string;
        first_seen: string;
        last_seen: string;
        tool_calls: number;
        successes: number;
        avg_response_ms: number;
    }>;
}

function formatMs(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
    return `${Math.round(n)}ms`;
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDay}d ago`;
}

function formatDuration(first: string, last: string): string {
    const diffMs = new Date(last).getTime() - new Date(first).getTime();
    if (diffMs < 1000) return "<1s";
    if (diffMs < 60_000) return `${Math.round(diffMs / 1000)}s`;
    if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m`;
    return `${(diffMs / 3_600_000).toFixed(1)}h`;
}

export function SessionList({ range }: { range: string }) {
    const { data, loading, error } = useAdminData<SessionsData>("sessions?limit=20", range);

    if (error) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-sm text-destructive">
                    Failed to load sessions: {error}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                        Loading...
                    </div>
                ) : !data?.sessions?.length ? (
                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                        No session data for this range
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                    <th className="pb-2 font-medium">Session</th>
                                    <th className="pb-2 font-medium text-right">Calls</th>
                                    <th className="pb-2 font-medium text-right">Duration</th>
                                    <th className="pb-2 font-medium text-right">Avg Latency</th>
                                    <th className="pb-2 font-medium text-right">Last Active</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.sessions.map((session) => (
                                    <tr
                                        key={session.session_id}
                                        className="border-b border-border/30"
                                    >
                                        <td className="py-2 font-mono text-xs text-muted-foreground">
                                            {session.session_id.slice(0, 8)}...
                                        </td>
                                        <td className="py-2 text-right tabular-nums">
                                            {session.tool_calls}
                                        </td>
                                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                                            {formatDuration(session.first_seen, session.last_seen)}
                                        </td>
                                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                                            {formatMs(session.avg_response_ms)}
                                        </td>
                                        <td className="py-2 text-right text-muted-foreground">
                                            {formatTime(session.last_seen)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
