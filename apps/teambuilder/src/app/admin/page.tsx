"use client";

import { useState } from "react";
import { OverviewCards } from "@/components/admin/OverviewCards";
import { UsageChart } from "@/components/admin/UsageChart";
import { CostBreakdown } from "@/components/admin/CostBreakdown";
import { ToolsTable } from "@/components/admin/ToolsTable";
import { SessionList } from "@/components/admin/SessionList";

const RANGES = [
    { label: "1h", value: "1h" },
    { label: "24h", value: "24h" },
    { label: "7d", value: "7d" },
    { label: "30d", value: "30d" },
] as const;

type Range = (typeof RANGES)[number]["value"];

export default function AdminDashboard() {
    const [range, setRange] = useState<Range>("24h");

    return (
        <div className="space-y-6">
            {/* Time range selector */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
                <div className="flex gap-1 rounded-lg bg-muted p-1">
                    {RANGES.map((r) => (
                        <button
                            key={r.value}
                            type="button"
                            onClick={() => setRange(r.value)}
                            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                                range === r.value
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Overview stats */}
            <OverviewCards range={range} />

            {/* Usage over time */}
            <UsageChart range={range} />

            {/* Two-column layout for costs and tools */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <CostBreakdown range={range} />
                <ToolsTable range={range} />
            </div>

            {/* Sessions */}
            <SessionList range={range} />
        </div>
    );
}
