// Analytics Engine returns numbers as numbers or as numeric strings depending
// on the column, so everything is coerced before use.
export function toNumber(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

export function formatNumber(value: unknown): string {
    const n = toNumber(value);
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
    return Math.round(n).toLocaleString();
}

export function formatMs(value: unknown): string {
    if (value === undefined || value === null || value === "") return "–";
    const n = toNumber(value);
    if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
    return `${Math.round(n)}ms`;
}

export function formatPercent(part: unknown, whole: unknown): string {
    const total = toNumber(whole);
    if (total <= 0) return "–";
    return `${((toNumber(part) / total) * 100).toFixed(1)}%`;
}
