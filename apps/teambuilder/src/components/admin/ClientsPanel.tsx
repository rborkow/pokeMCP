"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent, toNumber } from "./format";
import { useAdminData } from "./useAdminData";

interface ClientsData {
    connections: Array<{
        client: string;
        client_name: string;
        user_agent: string;
        connections: number;
    }>;
    toolCalls: Array<{ client: string; calls: number }>;
}

const CLIENT_LABELS: Record<string, string> = {
    claude: "Claude",
    chatgpt: "ChatGPT",
    other: "Other clients",
    "": "Not recorded",
};

const label = (client: string) => CLIENT_LABELS[client] ?? client;

export function ClientsPanel({ range }: { range: string }) {
    const { data, loading, error } = useAdminData<ClientsData>("clients", range);

    if (error) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-sm text-destructive">
                    Failed to load assistants: {error}
                </CardContent>
            </Card>
        );
    }

    const families = new Map<string, { connections: number; calls: number }>();
    const family = (client: string) => {
        if (!families.has(client)) families.set(client, { connections: 0, calls: 0 });
        return families.get(client) as { connections: number; calls: number };
    };
    for (const row of data?.connections ?? []) {
        family(row.client).connections += toNumber(row.connections);
    }
    for (const row of data?.toolCalls ?? []) family(row.client).calls += toNumber(row.calls);

    const rows = [...families.entries()].sort(([, a], [, b]) => b.calls - a.calls);
    const totalCalls = rows.reduce((sum, [, row]) => sum + row.calls, 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Assistants</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                        Loading...
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex h-40 items-center justify-center text-muted-foreground">
                        No connections in this range
                    </div>
                ) : (
                    <div className="space-y-5">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                    <th className="pb-2 font-medium">Assistant</th>
                                    <th className="pb-2 text-right font-medium">Connections</th>
                                    <th className="pb-2 text-right font-medium">Tool calls</th>
                                    <th className="pb-2 text-right font-medium">Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(([client, row]) => (
                                    <tr key={client} className="border-b border-border/30">
                                        <td className="py-2">{label(client)}</td>
                                        <td className="py-2 text-right tabular-nums">
                                            {formatNumber(row.connections)}
                                        </td>
                                        <td className="py-2 text-right tabular-nums">
                                            {formatNumber(row.calls)}
                                        </td>
                                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                                            {formatPercent(row.calls, totalCalls)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {(data?.connections?.length ?? 0) > 0 && (
                            <div>
                                <p className="mb-2 text-xs text-muted-foreground">
                                    What each client calls itself when it connects
                                </p>
                                <table className="w-full text-xs">
                                    <tbody>
                                        {data?.connections.slice(0, 12).map((row) => (
                                            <tr
                                                key={`${row.client}|${row.client_name}|${row.user_agent}`}
                                                className="border-b border-border/30"
                                            >
                                                <td className="py-1.5 font-mono">
                                                    {row.client_name || "(no name)"}
                                                </td>
                                                <td className="py-1.5 font-mono text-muted-foreground">
                                                    {row.user_agent || "–"}
                                                </td>
                                                <td className="py-1.5 text-right tabular-nums">
                                                    {formatNumber(row.connections)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
