import { z } from "zod";

/**
 * Structured assistant response cards. The coach emits these via the
 * `present_response_card` tool instead of folding facts into prose, so the
 * UI can render them with dedicated components (tables, diffs, etc.).
 */

const ToneSchema = z.enum(["neutral", "good", "warn", "bad"]);

const DataCardRowSchema = z.object({
    label: z.string(),
    value: z.string(),
    tone: ToneSchema.optional(),
});

export const DataCardSchema = z.object({
    kind: z.literal("data"),
    title: z.string(),
    rows: z.array(DataCardRowSchema).min(1).max(8),
    note: z.string().optional(),
});

export const TeamDiffChangeSchema = z.object({
    slot: z.number().min(0).max(5),
    from: z.string().optional(),
    to: z.string().optional(),
    note: z.string().optional(),
});

export const TeamDiffCardSchema = z.object({
    kind: z.literal("team_diff"),
    summary: z.string(),
    changes: z.array(TeamDiffChangeSchema).min(1).max(6),
});

export const MatchupCardSchema = z.object({
    kind: z.literal("matchup"),
    opponent: z.string(),
    winRateEstimate: z.string().optional(),
    leads: z.string().optional(),
    keyBenchmark: z.string().optional(),
    note: z.string().optional(),
});

export const AnalysisHighlightSchema = z.object({
    kind: z.literal("analysis_highlight"),
    focus: z.string(),
    detail: z.string(),
});

export const ResponseCardSchema = z.discriminatedUnion("kind", [
    DataCardSchema,
    TeamDiffCardSchema,
    MatchupCardSchema,
    AnalysisHighlightSchema,
]);

export type DataCard = z.infer<typeof DataCardSchema>;
export type TeamDiffCard = z.infer<typeof TeamDiffCardSchema>;
export type MatchupCard = z.infer<typeof MatchupCardSchema>;
export type AnalysisHighlightCard = z.infer<typeof AnalysisHighlightSchema>;
export type ResponseCard = z.infer<typeof ResponseCardSchema>;

export function parseResponseCard(input: unknown): ResponseCard | null {
    const result = ResponseCardSchema.safeParse(input);
    return result.success ? result.data : null;
}
