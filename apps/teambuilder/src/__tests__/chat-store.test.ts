import { describe, it, expect, beforeEach, vi } from "vitest";
import { useChatStore } from "@/stores/chat-store";
import { DEFAULT_PERSONALITY } from "@/lib/ai/personalities";

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

        it("should set personality to oak", () => {
            useChatStore.getState().setPersonality("oak");

            expect(useChatStore.getState().personality).toBe("oak");
        });

        it("should set personality to blue", () => {
            useChatStore.getState().setPersonality("blue");

            expect(useChatStore.getState().personality).toBe("blue");
        });

        it("should set personality back to kukui", () => {
            useChatStore.getState().setPersonality("blue");
            useChatStore.getState().setPersonality("kukui");

            expect(useChatStore.getState().personality).toBe("kukui");
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
});
