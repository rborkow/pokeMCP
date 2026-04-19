import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PERSONALITY } from "@/lib/ai/personalities";
import { useChatStore } from "@/stores/chat-store";

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

describe("chat-store", () => {
    beforeEach(() => {
        useChatStore.getState().clearChat();
        useChatStore.getState().setPersonality(DEFAULT_PERSONALITY);
        // Reset enableThinking to default (false)
        if (useChatStore.getState().enableThinking) {
            useChatStore.getState().toggleThinking();
        }
        vi.clearAllMocks();
    });

    describe("personality", () => {
        it("should have default personality on init", () => {
            expect(useChatStore.getState().personality).toBe(DEFAULT_PERSONALITY);
        });

        it("default personality is coach (Kukui retired)", () => {
            expect(DEFAULT_PERSONALITY).toBe("coach");
            expect(useChatStore.getState().personality).toBe("coach");
        });

        it("should set personality to oak", () => {
            useChatStore.getState().setPersonality("oak");

            expect(useChatStore.getState().personality).toBe("oak");
        });

        it("should set personality to blue", () => {
            useChatStore.getState().setPersonality("blue");

            expect(useChatStore.getState().personality).toBe("blue");
        });

        it("should still allow explicitly opting into kukui", () => {
            useChatStore.getState().setPersonality("blue");
            useChatStore.getState().setPersonality("kukui");

            expect(useChatStore.getState().personality).toBe("kukui");
        });
    });

    describe("persistence migration", () => {
        it("migrates v0 persisted kukui state to coach", () => {
            // Access the persist middleware's migrate hook directly.
            const migrate = useChatStore.persist.getOptions().migrate;
            expect(migrate).toBeDefined();

            const migrated = migrate?.(
                { personality: "kukui", aiProvider: "claude", enableThinking: false },
                0,
            );

            expect(migrated).toMatchObject({ personality: "coach" });
        });

        it("leaves oak/blue choices intact", () => {
            const migrate = useChatStore.persist.getOptions().migrate;
            const oakMigrated = migrate?.(
                { personality: "oak", aiProvider: "claude", enableThinking: false },
                0,
            );
            const blueMigrated = migrate?.(
                { personality: "blue", aiProvider: "claude", enableThinking: false },
                0,
            );

            expect(oakMigrated).toMatchObject({ personality: "oak" });
            expect(blueMigrated).toMatchObject({ personality: "blue" });
        });
    });

    describe("aiProvider", () => {
        it("should default to claude", () => {
            expect(useChatStore.getState().aiProvider).toBe("claude");
        });

        it("should set ai provider", () => {
            useChatStore.getState().setAIProvider("cloudflare");

            expect(useChatStore.getState().aiProvider).toBe("cloudflare");
        });
    });

    describe("enableThinking", () => {
        it("should default to false", () => {
            expect(useChatStore.getState().enableThinking).toBe(false);
        });

        it("should toggle thinking", () => {
            useChatStore.getState().toggleThinking();

            expect(useChatStore.getState().enableThinking).toBe(true);
        });

        it("should toggle back to false", () => {
            useChatStore.getState().toggleThinking();
            useChatStore.getState().toggleThinking();

            expect(useChatStore.getState().enableThinking).toBe(false);
        });
    });

    describe("clearChat", () => {
        it("should clear persisted messages from localStorage", () => {
            useChatStore.getState().clearChat();

            expect(localStorageMock.removeItem).toHaveBeenCalledWith("pokemcp-chat-messages");
        });
    });

    describe("queuedPrompt", () => {
        it("should default to null", () => {
            expect(useChatStore.getState().queuedPrompt).toBeNull();
        });

        it("should queue a prompt", () => {
            useChatStore.getState().queuePrompt("Build me a rain team");

            expect(useChatStore.getState().queuedPrompt).toBe("Build me a rain team");
        });

        it("should clear queued prompt", () => {
            useChatStore.getState().queuePrompt("Build me a rain team");
            useChatStore.getState().clearQueuedPrompt();

            expect(useChatStore.getState().queuedPrompt).toBeNull();
        });

        it("should overwrite existing queued prompt", () => {
            useChatStore.getState().queuePrompt("First prompt");
            useChatStore.getState().queuePrompt("Second prompt");

            expect(useChatStore.getState().queuedPrompt).toBe("Second prompt");
        });
    });

    describe("lastUserPrompt", () => {
        it("should default to null", () => {
            expect(useChatStore.getState().lastUserPrompt).toBeNull();
        });

        it("should set last user prompt", () => {
            useChatStore.getState().setLastUserPrompt("Suggest a move for Garchomp");

            expect(useChatStore.getState().lastUserPrompt).toBe("Suggest a move for Garchomp");
        });

        it("should overwrite previous last user prompt", () => {
            useChatStore.getState().setLastUserPrompt("First prompt");
            useChatStore.getState().setLastUserPrompt("Second prompt");

            expect(useChatStore.getState().lastUserPrompt).toBe("Second prompt");
        });
    });

    describe("systemLog", () => {
        it("defaults to an empty array", () => {
            expect(useChatStore.getState().systemLog).toEqual([]);
        });

        it("appendSystemLog adds entries with generated id and timestamp", () => {
            useChatStore.getState().appendSystemLog({
                text: "Changed Kingambit's item to Black Glasses.",
                slot: 3,
                kind: "user_edit",
            });
            const entries = useChatStore.getState().systemLog;
            expect(entries).toHaveLength(1);
            expect(entries[0].text).toContain("Black Glasses");
            expect(entries[0].slot).toBe(3);
            expect(typeof entries[0].id).toBe("string");
            expect(typeof entries[0].createdAt).toBe("number");
        });

        it("is not included in the persisted snapshot", () => {
            useChatStore.getState().appendSystemLog({
                text: "change",
                slot: 0,
                kind: "user_edit",
            });
            const partialize = useChatStore.persist.getOptions().partialize;
            const snapshot = partialize?.(useChatStore.getState());
            expect(snapshot).not.toHaveProperty("systemLog");
        });

        it("clearChat wipes the system log", () => {
            useChatStore.getState().appendSystemLog({
                text: "hi",
                slot: 0,
                kind: "user_edit",
            });
            useChatStore.getState().clearChat();
            expect(useChatStore.getState().systemLog).toEqual([]);
        });
    });
});
