/** `structuredContent` of the analyze_team_types tool (see its outputSchema). */
export interface TypeChartData {
    team: { name: string; types: string[] }[];
    notFound: string[];
    matchups: { type: string; weak: string[]; resist: string[]; immune: string[] }[];
    sharedWeaknesses: string[];
    unresisted: string[];
    suggestedTypes: { type: string; covers: string[] }[];
}
