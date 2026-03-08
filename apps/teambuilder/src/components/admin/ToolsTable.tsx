"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminData } from "./useAdminData";

interface ToolsData {
    tools: Array<{
        tool_name: string;
        calls: number;
        successes: number;
        avg_response_ms: number;
    }>;
}

function formatMs(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
    return `${Math.round(n)}ms`;
}

export function ToolsTable({ range }: { range: string }) {
    const { data, loading, error } = useAdminData<ToolsData>("tools", range);

    if (error) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-sm text-destructive">
                    Failed to load tools data: {error}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Tool Performance</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                        Loading...
                    </div>
                ) : !data?.tools?.length ? (
                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                        No tool data for this range
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                    <th className="pb-2 font-medium">Tool</th>
                                    <th className="pb-2 font-medium text-right">Calls</th>
                                    <th className="pb-2 font-medium text-right">OK%</th>
                                    <th className="pb-2 font-medium text-right">Avg</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.tools.map((tool) => {
                                    const successRate =
                                        tool.calls > 0
                                            ? ((tool.successes / tool.calls) * 100).toFixed(0)
                                            : "0";
                                    return (
                                        <tr
                                            key={tool.tool_name}
                                            className="border-b border-border/30"
                                        >
                                            <td className="py-2 font-mono text-xs">
                                                {tool.tool_name}
                                            </td>
                                            <td className="py-2 text-right tabular-nums">
                                                {tool.calls}
                                            </td>
                                            <td className="py-2 text-right tabular-nums">
                                                <span
                                                    className={
                                                        Number(successRate) < 95
                                                            ? "text-destructive"
                                                            : "text-green-500"
                                                    }
                                                >
                                                    {successRate}%
                                                </span>
                                            </td>
                                            <td className="py-2 text-right tabular-nums text-muted-foreground">
                                                {formatMs(tool.avg_response_ms)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
