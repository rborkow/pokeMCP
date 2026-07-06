import { describe, expect, it } from "vitest";
import {
    ChatRequestSchema,
    InterviewRequestSchema,
    MAX_CHAT_HISTORY_ENTRIES,
    MAX_CHAT_MESSAGE_CHARS,
    MAX_HISTORY_ENTRY_CHARS,
    MAX_INTERVIEW_ANSWER_CHARS,
    MAX_RECENT_EDITS,
    MetaReportRequestSchema,
    sanitizeChatHistory,
    sanitizeRecentEdits,
    TeamPokemonSchema,
    toUserFirst,
} from "@/lib/api/ai-schemas";

/** Mirrors what src/lib/ai/connection.ts actually POSTs to /api/ai/claude/stream. */
const legitChatBody = {
    message: "What should I add to round out my team?",
    team: [
        {
            pokemon: "Landorus-Therian",
            moves: ["Earthquake", "U-turn", "Stealth Rock", "Stone Edge"],
            ability: "Intimidate",
            item: "Rocky Helmet",
            nature: "Impish",
            level: 100,
            teraType: "Water",
            evs: { hp: 252, def: 240, spe: 16 },
            ivs: { hp: 31, atk: 31 },
        },
    ],
    format: "gen9ou",
    mode: "singles",
    personality: "coach",
    enableThinking: false,
    chatHistory: [
        { role: "user", content: "Build me a rain team" },
        { role: "assistant", content: "Here's a rain core to start with..." },
    ],
    recentEdits: [{ text: "You set Pelipper's item to Damp Rock", slot: 0, createdAt: 1720000000 }],
};

describe("ChatRequestSchema", () => {
    it("accepts the payload shape the real client sends", () => {
        const parsed = ChatRequestSchema.safeParse(legitChatBody);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.message).toBe(legitChatBody.message);
            expect(parsed.data.team).toHaveLength(1);
            expect(parsed.data.personality).toBe("coach");
            expect(parsed.data.chatHistory).toHaveLength(2);
            expect(parsed.data.recentEdits).toHaveLength(1);
        }
    });

    it("accepts a minimal body (message only)", () => {
        const parsed = ChatRequestSchema.safeParse({ message: "hi" });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.team).toEqual([]);
            expect(parsed.data.format).toBe("gen9ou");
            expect(parsed.data.mode).toBe("singles");
            expect(parsed.data.chatHistory).toEqual([]);
            expect(parsed.data.recentEdits).toEqual([]);
        }
    });

    it("accepts a full Showdown team paste as the message", () => {
        const paste = "Pelipper @ Damp Rock\nAbility: Drizzle\n- Hurricane\n- Surf\n".repeat(30);
        expect(paste.length).toBeLessThanOrEqual(MAX_CHAT_MESSAGE_CHARS);
        expect(ChatRequestSchema.safeParse({ ...legitChatBody, message: paste }).success).toBe(
            true,
        );
    });

    it("rejects an oversized message", () => {
        const parsed = ChatRequestSchema.safeParse({
            ...legitChatBody,
            message: "x".repeat(MAX_CHAT_MESSAGE_CHARS + 1),
        });
        expect(parsed.success).toBe(false);
    });

    it("rejects a missing or empty message", () => {
        expect(ChatRequestSchema.safeParse({ ...legitChatBody, message: "" }).success).toBe(false);
        const { message: _omitted, ...withoutMessage } = legitChatBody;
        expect(ChatRequestSchema.safeParse(withoutMessage).success).toBe(false);
    });

    it("rejects a team with more than six members", () => {
        const member = legitChatBody.team[0];
        const parsed = ChatRequestSchema.safeParse({
            ...legitChatBody,
            team: Array.from({ length: 7 }, () => member),
        });
        expect(parsed.success).toBe(false);
    });

    it("falls back to defaults for unknown personality/mode/format values", () => {
        const parsed = ChatRequestSchema.safeParse({
            ...legitChatBody,
            personality: "definitely-not-a-personality",
            mode: "hexagons",
            format: "",
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.personality).toBe("coach");
            expect(parsed.data.mode).toBe("singles");
            expect(parsed.data.format).toBe("gen9ou");
        }
    });

    it("clamps an oversized chat history instead of rejecting", () => {
        const history = Array.from({ length: 40 }, (_, i) => ({
            role: i % 2 === 0 ? "user" : "assistant",
            content: `message ${i} ${"y".repeat(MAX_HISTORY_ENTRY_CHARS)}`,
        }));
        const parsed = ChatRequestSchema.safeParse({ ...legitChatBody, chatHistory: history });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.chatHistory).toHaveLength(MAX_CHAT_HISTORY_ENTRIES);
            for (const entry of parsed.data.chatHistory) {
                expect(entry.content.length).toBeLessThanOrEqual(MAX_HISTORY_ENTRY_CHARS);
            }
        }
    });
});

describe("TeamPokemonSchema", () => {
    it("rejects more than four moves", () => {
        const parsed = TeamPokemonSchema.safeParse({
            pokemon: "Mew",
            moves: ["a", "b", "c", "d", "e"],
        });
        expect(parsed.success).toBe(false);
    });

    it("rejects oversized name fields", () => {
        expect(TeamPokemonSchema.safeParse({ pokemon: "z".repeat(101), moves: [] }).success).toBe(
            false,
        );
        expect(
            TeamPokemonSchema.safeParse({
                pokemon: "Mew",
                moves: [],
                item: "z".repeat(101),
            }).success,
        ).toBe(false);
    });
});

describe("sanitizeChatHistory", () => {
    it("drops entries with invalid roles or shapes", () => {
        const sanitized = sanitizeChatHistory([
            { role: "user", content: "keep me" },
            { role: "system", content: "drop me" },
            { role: "assistant", content: "keep me too" },
            { role: "user" },
            "not an object",
            null,
        ]);
        expect(sanitized).toEqual([
            { role: "user", content: "keep me" },
            { role: "assistant", content: "keep me too" },
        ]);
    });

    it("truncates long entries and keeps only the newest slice", () => {
        const sanitized = sanitizeChatHistory(
            Array.from({ length: 50 }, (_, i) => ({
                role: "user",
                content: `${i}:${"x".repeat(5_000)}`,
            })),
        );
        expect(sanitized).toHaveLength(MAX_CHAT_HISTORY_ENTRIES);
        expect(sanitized[0].content.startsWith(String(50 - MAX_CHAT_HISTORY_ENTRIES))).toBe(true);
        for (const entry of sanitized) {
            expect(entry.content.length).toBe(MAX_HISTORY_ENTRY_CHARS);
        }
    });

    it("returns an empty array for non-array input", () => {
        expect(sanitizeChatHistory("nope")).toEqual([]);
        expect(sanitizeChatHistory(undefined)).toEqual([]);
    });
});

describe("toUserFirst (assistant-first history fix)", () => {
    it("drops leading assistant messages after slicing", () => {
        const messages = [
            { role: "assistant" as const, content: "orphaned reply" },
            { role: "user" as const, content: "question" },
            { role: "assistant" as const, content: "answer" },
        ];
        expect(toUserFirst(messages)).toEqual(messages.slice(1));
    });

    it("returns an empty array when no user message exists", () => {
        expect(toUserFirst([{ role: "assistant" as const, content: "only me" }])).toEqual([]);
    });

    it("leaves a user-first history untouched", () => {
        const messages = [
            { role: "user" as const, content: "q" },
            { role: "assistant" as const, content: "a" },
        ];
        expect(toUserFirst(messages)).toEqual(messages);
    });
});

describe("sanitizeRecentEdits", () => {
    it("truncates edit text and clamps to the newest entries", () => {
        const sanitized = sanitizeRecentEdits(
            Array.from({ length: 10 }, (_, i) => ({
                text: `${i}:${"e".repeat(2_000)}`,
                slot: i % 6,
                createdAt: i,
            })),
        );
        expect(sanitized).toHaveLength(MAX_RECENT_EDITS);
        for (const edit of sanitized) {
            expect(edit.text.length).toBeLessThanOrEqual(500);
        }
        expect(sanitized[sanitized.length - 1].createdAt).toBe(9);
    });

    it("drops malformed entries", () => {
        expect(sanitizeRecentEdits([{ text: 42, slot: "x" }, null, "junk"])).toEqual([]);
    });
});

describe("InterviewRequestSchema", () => {
    const legitInterviewBody = {
        answers: {
            format: "gen9vgc2026regf",
            start: "Trick room around Ursaluna-Bloodmoon",
            playstyle: "trick_room",
            preferences: undefined,
        },
        format: "gen9vgc2026regf",
        mode: "vgc",
    };

    it("accepts the payload shape InterviewShell sends", () => {
        const parsed = InterviewRequestSchema.safeParse(legitInterviewBody);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.answers.start).toBe(legitInterviewBody.answers.start);
        }
    });

    it("accepts a pasted Showdown team as the 'counter a team' answer", () => {
        const paste = "Incineroar @ Safety Goggles\nAbility: Intimidate\n- Fake Out\n".repeat(40);
        expect(paste.length).toBeLessThanOrEqual(MAX_INTERVIEW_ANSWER_CHARS);
        const parsed = InterviewRequestSchema.safeParse({
            ...legitInterviewBody,
            answers: { ...legitInterviewBody.answers, start: paste },
        });
        expect(parsed.success).toBe(true);
    });

    it("rejects an oversized answer", () => {
        const parsed = InterviewRequestSchema.safeParse({
            ...legitInterviewBody,
            answers: {
                ...legitInterviewBody.answers,
                start: "x".repeat(MAX_INTERVIEW_ANSWER_CHARS + 1),
            },
        });
        expect(parsed.success).toBe(false);
    });

    it("rejects a missing format or invalid mode", () => {
        expect(
            InterviewRequestSchema.safeParse({ ...legitInterviewBody, format: undefined }).success,
        ).toBe(false);
        expect(
            InterviewRequestSchema.safeParse({ ...legitInterviewBody, mode: "chess" }).success,
        ).toBe(false);
    });
});

describe("MetaReportRequestSchema", () => {
    it("accepts the payload MetaReportDialog sends", () => {
        const parsed = MetaReportRequestSchema.safeParse({
            format: "gen9vgc2026regi",
            mode: "vgc",
            window: 6,
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.window).toBe(6);
        }
    });

    it("applies defaults for an empty body", () => {
        const parsed = MetaReportRequestSchema.safeParse({});
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data).toEqual({ format: "gen9vgc2026regi", window: 6, mode: "vgc" });
        }
    });

    it("clamps out-of-range or malformed values to defaults", () => {
        const parsed = MetaReportRequestSchema.safeParse({
            format: "f".repeat(500),
            window: 9_999,
            mode: { nested: "object" },
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data).toEqual({ format: "gen9vgc2026regi", window: 6, mode: "vgc" });
        }
    });
});
