/** `structuredContent` of the analyze_team_types tool (see its outputSchema). */
export interface TypeChartData {
    team: { name: string; types: string[] }[];
    notFound: string[];
    matchups: { type: string; weak: string[]; resist: string[]; immune: string[] }[];
    sharedWeaknesses: string[];
    unresisted: string[];
    suggestedTypes: { type: string; covers: string[] }[];
}

/**
 * Whether a tool result has the arrays the chart reads. A host could hand the
 * view an error result or a result from an older server; show a message then
 * instead of throwing.
 */
export function isTypeChartData(value: unknown): value is TypeChartData {
    const data = value as Partial<TypeChartData> | null;
    return (
        typeof data === "object" &&
        data !== null &&
        ["team", "notFound", "matchups", "sharedWeaknesses", "unresisted", "suggestedTypes"].every(
            (key) => Array.isArray((data as Record<string, unknown>)[key]),
        )
    );
}
