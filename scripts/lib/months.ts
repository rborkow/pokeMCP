/**
 * The `count` months before `month` ("YYYY-MM"), most recent first.
 * previousMonths("2026-01", 2) → ["2025-12", "2025-11"].
 */
export function previousMonths(month: string, count: number): string[] {
    const [year, monthNumber] = month.split("-").map(Number);
    const months: string[] = [];
    let index = year * 12 + (monthNumber - 1);
    for (let i = 0; i < count; i++) {
        index -= 1;
        months.push(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
    }
    return months;
}
