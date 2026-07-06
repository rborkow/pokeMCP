import { z } from "zod";
import { DEFAULT_PERSONALITY, PERSONALITIES, type PersonalityId } from "@/lib/ai/personalities";

/**
 * Zod request schemas for the paid AI streaming endpoints. Every free-text
 * field is hard-capped so a hostile client cannot inflate a Claude call with
 * unbounded input. Caps are sized well above what the legitimate client
 * sends (see src/lib/ai/connection.ts and InterviewShell.tsx):
 *
 * - Chat message: the composer is an unbounded textarea; 4 000 chars covers
 *   a full six-Pokémon Showdown paste (~2 500 chars) with room to spare.
 * - Chat history entries are truncated (not rejected) — the client sends the
 *   whole conversation and the server only ever uses the newest slice.
 * - Interview answers: 4 000 chars — the "counter a team" step invites a
 *   Showdown paste, which can legitimately exceed the 1 500 chars a typed
 *   answer would need.
 */

export const MAX_CHAT_MESSAGE_CHARS = 4_000;
export const MAX_CHAT_HISTORY_ENTRIES = 12;
export const MAX_HISTORY_ENTRY_CHARS = 2_000;
export const MAX_RECENT_EDITS = 3;
export const MAX_RECENT_EDIT_CHARS = 500;
export const MAX_INTERVIEW_ANSWER_CHARS = 4_000;
export const MAX_TEAM_MEMBERS = 6;
export const MAX_NAME_FIELD_CHARS = 100;
export const MAX_FORMAT_CHARS = 50;

const FormatSchema = z.string().min(1).max(MAX_FORMAT_CHARS);
const ModeSchema = z.enum(["singles", "vgc"]);

const PersonalityIdSchema = z
    .custom<PersonalityId>((value) => typeof value === "string" && value in PERSONALITIES)
    .catch(DEFAULT_PERSONALITY);

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

const nameField = z.string().max(MAX_NAME_FIELD_CHARS);

const StatSpreadSchema = z.object({
    hp: z.number().min(0).max(255).optional(),
    atk: z.number().min(0).max(255).optional(),
    def: z.number().min(0).max(255).optional(),
    spa: z.number().min(0).max(255).optional(),
    spd: z.number().min(0).max(255).optional(),
    spe: z.number().min(0).max(255).optional(),
});

/** Mirrors the TeamPokemon interface in src/types/pokemon.ts with hard caps. */
export const TeamPokemonSchema = z.object({
    pokemon: z.string().min(1).max(MAX_NAME_FIELD_CHARS),
    moves: z.array(nameField).max(4),
    ability: nameField.optional(),
    item: nameField.optional(),
    nature: nameField.optional(),
    level: z.number().min(1).max(100).optional(),
    nickname: nameField.optional(),
    shiny: z.boolean().optional(),
    gender: z.enum(["M", "F"]).optional(),
    teraType: nameField.optional(),
    evs: StatSpreadSchema.optional(),
    ivs: StatSpreadSchema.optional(),
});

// ---------------------------------------------------------------------------
// Chat history / recent edits (sanitized, never rejected — the legit client
// sends its full conversation and only the newest slice is used)
// ---------------------------------------------------------------------------

export interface ChatHistoryEntry {
    role: "user" | "assistant";
    content: string;
}

const ChatHistoryEntrySchema = z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
});

/**
 * Drops entries with invalid roles/shapes, truncates each entry's content,
 * and clamps to the newest MAX_CHAT_HISTORY_ENTRIES entries.
 */
export function sanitizeChatHistory(value: unknown): ChatHistoryEntry[] {
    if (!Array.isArray(value)) return [];
    const entries: ChatHistoryEntry[] = [];
    for (const item of value) {
        const parsed = ChatHistoryEntrySchema.safeParse(item);
        if (!parsed.success) continue;
        const content = parsed.data.content.slice(0, MAX_HISTORY_ENTRY_CHARS);
        if (!content.trim()) continue;
        entries.push({ role: parsed.data.role, content });
    }
    return entries.slice(-MAX_CHAT_HISTORY_ENTRIES);
}

/**
 * Drops leading messages until the first "user" turn — `slice(-N)` can leave
 * an assistant-first array, which the Anthropic Messages API rejects with a
 * 400 (the first message must have role "user").
 */
export function toUserFirst<T extends { role: "user" | "assistant" }>(messages: T[]): T[] {
    const firstUser = messages.findIndex((m) => m.role === "user");
    return firstUser === -1 ? [] : messages.slice(firstUser);
}

export interface RecentEditEntry {
    text: string;
    slot: number;
    createdAt: number;
}

const RecentEditSchema = z.object({
    text: z.string(),
    slot: z.number(),
    createdAt: z.number(),
});

/** Truncates edit text and clamps to the newest MAX_RECENT_EDITS entries. */
export function sanitizeRecentEdits(value: unknown): RecentEditEntry[] {
    if (!Array.isArray(value)) return [];
    const edits: RecentEditEntry[] = [];
    for (const item of value) {
        const parsed = RecentEditSchema.safeParse(item);
        if (!parsed.success) continue;
        edits.push({
            text: parsed.data.text.slice(0, MAX_RECENT_EDIT_CHARS),
            slot: parsed.data.slot,
            createdAt: parsed.data.createdAt,
        });
    }
    return edits.slice(-MAX_RECENT_EDITS);
}

// ---------------------------------------------------------------------------
// Per-route request schemas
// ---------------------------------------------------------------------------

/** POST /api/ai/claude/stream */
export const ChatRequestSchema = z.object({
    message: z.string().min(1).max(MAX_CHAT_MESSAGE_CHARS),
    team: z.array(TeamPokemonSchema).max(MAX_TEAM_MEMBERS).default([]),
    format: FormatSchema.catch("gen9ou"),
    mode: ModeSchema.catch("singles"),
    enableThinking: z.boolean().optional().catch(undefined),
    personality: PersonalityIdSchema,
    chatHistory: z.unknown().transform(sanitizeChatHistory),
    recentEdits: z.unknown().transform(sanitizeRecentEdits),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

const InterviewAnswerSchema = z.string().max(MAX_INTERVIEW_ANSWER_CHARS);

/** POST /api/ai/interview/stream */
export const InterviewRequestSchema = z.object({
    answers: z.object({
        format: InterviewAnswerSchema.optional(),
        start: InterviewAnswerSchema.optional(),
        playstyle: InterviewAnswerSchema.optional(),
        preferences: InterviewAnswerSchema.optional(),
    }),
    format: FormatSchema,
    mode: ModeSchema,
});

export type InterviewRequest = z.infer<typeof InterviewRequestSchema>;

/**
 * POST /api/ai/meta-report/stream — the route has always defaulted absent
 * fields, so invalid values clamp to those defaults instead of rejecting.
 */
export const MetaReportRequestSchema = z.object({
    format: FormatSchema.catch("gen9vgc2026regi"),
    window: z.number().int().min(1).max(24).catch(6),
    mode: ModeSchema.catch("vgc"),
});

export type MetaReportRequest = z.infer<typeof MetaReportRequestSchema>;
