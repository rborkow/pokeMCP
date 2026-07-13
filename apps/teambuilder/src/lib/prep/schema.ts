import { z } from "zod";
import { getDefaultChampionsCapability } from "./capabilities";

export const MAX_TEAM_PASTE_BYTES = 32 * 1024;
export const MAX_COACH_MESSAGE_CHARS = 2_000;
export const MAX_COACH_HISTORY_MESSAGES = 20;
export const PREP_MECHANICS_VERSION = getDefaultChampionsCapability().mechanicsVersion;

export const EvidenceKindSchema = z.enum([
    "tournament-source",
    "calculated",
    "model-suggestion",
    "beta-mechanics",
]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const TeamPokemonSchema = z.object({
    pokemon: z.string().trim().min(1).max(80),
    moves: z.array(z.string().trim().min(1).max(80)).max(4),
    ability: z.string().trim().max(80).optional(),
    item: z.string().trim().max(80).optional(),
    nature: z.string().trim().max(40).optional(),
    level: z.number().int().min(1).max(100).optional(),
    nickname: z.string().trim().max(80).optional(),
    teraType: z.string().trim().max(30).optional(),
    evs: z
        .object({
            hp: z.number().int().min(0).max(252).optional(),
            atk: z.number().int().min(0).max(252).optional(),
            def: z.number().int().min(0).max(252).optional(),
            spa: z.number().int().min(0).max(252).optional(),
            spd: z.number().int().min(0).max(252).optional(),
            spe: z.number().int().min(0).max(252).optional(),
        })
        .optional(),
    ivs: z
        .object({
            hp: z.number().int().min(0).max(31).optional(),
            atk: z.number().int().min(0).max(31).optional(),
            def: z.number().int().min(0).max(31).optional(),
            spa: z.number().int().min(0).max(31).optional(),
            spd: z.number().int().min(0).max(31).optional(),
            spe: z.number().int().min(0).max(31).optional(),
        })
        .optional(),
    shiny: z.boolean().optional(),
    gender: z.enum(["M", "F"]).optional(),
});

export const TeamSnapshotSchema = z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    format: z.string().min(1),
    pokemon: z.array(TeamPokemonSchema).min(1).max(6),
    sourceLabel: z.string().max(160).optional(),
    sourceUrl: z.url().optional(),
    updatedAt: z.string(),
});
export type TeamSnapshot = z.infer<typeof TeamSnapshotSchema>;

export const OpponentSourceSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("event-team"), eventId: z.string(), teamId: z.string() }),
    z.object({ kind: z.literal("paste"), raw: z.string().max(MAX_TEAM_PASTE_BYTES) }),
    z.object({ kind: z.literal("manual") }),
]);
export type OpponentSource = z.infer<typeof OpponentSourceSchema>;

export const EvidenceReferenceSchema = z.object({
    id: z.string(),
    kind: EvidenceKindSchema,
    label: z.string(),
    detail: z.string(),
    sourceUrl: z.url().optional(),
});
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;

const MatchupRoleSchema = z.object({
    pokemon: z.string(),
    role: z.string(),
    note: z.string(),
    evidenceIds: z.array(z.string()).min(1),
});

const LeadPlanSchema = z.object({
    pokemon: z.tuple([z.string(), z.string()]),
    purpose: z.string(),
    useWhen: z.string(),
    evidenceIds: z.array(z.string()).min(1),
});

const OpeningLineSchema = z.object({
    lead: z.tuple([z.string(), z.string()]),
    primary: z.string(),
    alternative: z.string(),
    evidenceIds: z.array(z.string()).min(1),
});

const DangerPointSchema = z.object({
    title: z.string(),
    detail: z.string(),
    response: z.string(),
    evidenceIds: z.array(z.string()).min(1),
});

const PracticeItemSchema = z.object({
    label: z.string(),
    done: z.boolean().default(false),
});

export const BattleCardSchema = z.object({
    matchupRoles: z.array(MatchupRoleSchema),
    bringFour: z.array(z.string()).length(4),
    leadPlans: z.array(LeadPlanSchema).length(2),
    likelyOpponentLeads: z.array(LeadPlanSchema).min(1).max(2),
    openingLines: z.array(OpeningLineSchema).min(1).max(2),
    dangerPoints: z.array(DangerPointSchema).min(1),
    practiceChecklist: z.array(PracticeItemSchema).min(3),
    evidence: z.array(EvidenceReferenceSchema).min(2),
});
export type BattleCard = z.infer<typeof BattleCardSchema>;

export const PrepPlanSchema = z.object({
    id: z.string().uuid(),
    format: z.string().startsWith("champions-"),
    ownTeam: TeamSnapshotSchema,
    opponentTeam: TeamSnapshotSchema,
    opponentSource: OpponentSourceSchema,
    battleCard: BattleCardSchema,
    mechanicsVersion: z.string(),
    status: z.enum(["draft", "complete"]),
    exportedAt: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type PrepPlan = z.infer<typeof PrepPlanSchema>;

export const CoachMessageSchema = z.object({
    id: z.string().uuid(),
    planId: z.string().uuid(),
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(8_000),
    createdAt: z.string(),
});
export type CoachMessage = z.infer<typeof CoachMessageSchema>;

export const GeneratePrepRequestSchema = z.object({
    ownTeam: TeamSnapshotSchema,
    opponentTeam: TeamSnapshotSchema,
    opponentSource: OpponentSourceSchema,
});

export function createTeamSnapshot(
    name: string,
    format: string,
    pokemon: z.infer<typeof TeamPokemonSchema>[],
    options: { id?: string; sourceLabel?: string; sourceUrl?: string } = {},
): TeamSnapshot {
    return TeamSnapshotSchema.parse({
        id: options.id ?? crypto.randomUUID(),
        name,
        format,
        pokemon,
        sourceLabel: options.sourceLabel,
        sourceUrl: options.sourceUrl,
        updatedAt: new Date().toISOString(),
    });
}
