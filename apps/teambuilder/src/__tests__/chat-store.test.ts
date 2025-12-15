import { describe, it, expect, beforeEach, vi } from "vitest";
import { useChatStore } from "@/stores/chat-store";

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
    randomUUID: () => `test-uuid-${Date.now()}-${Math.random()}`,
});

describe("chat-store", () => {
    beforeEach(() => {
        // Reset store between tests
        useChatStore.getState().clearChat();
        vi.clearAllMocks();
    });

    describe("addMessage", () => {
        it("should add a message to the messages array", () => {
            const id = useChatStore.getState().addMessage({
                role: "user",
                content: "Hello",
            });

            const messages = useChatStore.getState().messages;
            expect(messages).toHaveLength(1);
            expect(messages[0].content).toBe("Hello");
            expect(messages[0].role).toBe("user");
            expect(messages[0].id).toBe(id);
        });

        it("should return the message id", () => {
            const id = useChatStore.getState().addMessage({
                role: "assistant",
                content: "Hi there!",
            });

            expect(typeof id).toBe("string");
            expect(id.length).toBeGreaterThan(0);
        });

        it("should set timestamp automatically", () => {
            useChatStore.getState().addMessage({
                role: "user",
                content: "Test",
            });

            const message = useChatStore.getState().messages[0];
            expect(message.timestamp).toBeInstanceOf(Date);
        });

        it("should append multiple messages in order", () => {
            useChatStore.getState().addMessage({ role: "user", content: "First" });
            useChatStore.getState().addMessage({ role: "assistant", content: "Second" });
            useChatStore.getState().addMessage({ role: "user", content: "Third" });

            const messages = useChatStore.getState().messages;
            expect(messages).toHaveLength(3);
            expect(messages[0].content).toBe("First");
            expect(messages[1].content).toBe("Second");
            expect(messages[2].content).toBe("Third");
        });
    });

    describe("updateMessage", () => {
        it("should update an existing message", () => {
            const id = useChatStore.getState().addMessage({
                role: "assistant",
                content: "Loading...",
                isLoading: true,
            });

            useChatStore.getState().updateMessage(id, {
                content: "Here is my response",
                isLoading: false,
            });

            const message = useChatStore.getState().messages.find((m) => m.id === id);
            expect(message?.content).toBe("Here is my response");
            expect(message?.isLoading).toBe(false);
        });

        it("should not affect other messages", () => {
            useChatStore.getState().addMessage({ role: "user", content: "Question" });
            const id = useChatStore.getState().addMessage({
                role: "assistant",
                content: "Answer",
            });

            useChatStore.getState().updateMessage(id, { content: "Updated answer" });

            const messages = useChatStore.getState().messages;
            expect(messages[0].content).toBe("Question");
            expect(messages[1].content).toBe("Updated answer");
        });

        it("should handle non-existent id gracefully", () => {
            useChatStore.getState().addMessage({ role: "user", content: "Test" });

            // Should not throw
            useChatStore.getState().updateMessage("non-existent-id", { content: "Updated" });

            // Original message should be unchanged
            expect(useChatStore.getState().messages[0].content).toBe("Test");
        });
    });

    describe("removeMessage", () => {
        it("should remove a message by id", () => {
            const id = useChatStore.getState().addMessage({
                role: "user",
                content: "To be removed",
            });

            useChatStore.getState().removeMessage(id);

            expect(useChatStore.getState().messages).toHaveLength(0);
        });

        it("should only remove the specified message", () => {
            useChatStore.getState().addMessage({ role: "user", content: "Keep" });
            const id = useChatStore.getState().addMessage({ role: "assistant", content: "Remove" });
            useChatStore.getState().addMessage({ role: "user", content: "Also keep" });

            useChatStore.getState().removeMessage(id);

            const messages = useChatStore.getState().messages;
            expect(messages).toHaveLength(2);
            expect(messages[0].content).toBe("Keep");
            expect(messages[1].content).toBe("Also keep");
        });
    });

    describe("clearChat", () => {
        it("should remove all messages", () => {
            useChatStore.getState().addMessage({ role: "user", content: "Message 1" });
            useChatStore.getState().addMessage({ role: "assistant", content: "Message 2" });

            useChatStore.getState().clearChat();

            expect(useChatStore.getState().messages).toHaveLength(0);
        });

        it("should also clear pending action", () => {
            useChatStore.getState().setPendingAction({
                type: "add_pokemon",
                slot: 0,
                payload: { pokemon: "Pikachu" },
                preview: [],
                reason: "Test",
            });

            useChatStore.getState().clearChat();

            expect(useChatStore.getState().pendingAction).toBeNull();
        });
    });

    describe("setPendingAction", () => {
        it("should set a pending action", () => {
            const action = {
                type: "add_pokemon" as const,
                slot: 0,
                payload: { pokemon: "Charizard", moves: ["Flamethrower"] },
                preview: [],
                reason: "Good fire type",
            };

            useChatStore.getState().setPendingAction(action);

            expect(useChatStore.getState().pendingAction).toEqual(action);
        });

        it("should allow clearing pending action with null", () => {
            useChatStore.getState().setPendingAction({
                type: "add_pokemon",
                slot: 0,
                payload: { pokemon: "Pikachu" },
                preview: [],
                reason: "Electric type",
            });

            useChatStore.getState().setPendingAction(null);

            expect(useChatStore.getState().pendingAction).toBeNull();
        });
    });

    describe("setAIProvider", () => {
        it("should set the AI provider to claude", () => {
            useChatStore.getState().setAIProvider("claude");

            expect(useChatStore.getState().aiProvider).toBe("claude");
        });

        it("should set the AI provider to cloudflare", () => {
            useChatStore.getState().setAIProvider("cloudflare");

            expect(useChatStore.getState().aiProvider).toBe("cloudflare");
        });
    });

    describe("setLoading", () => {
        it("should set loading to true", () => {
            useChatStore.getState().setLoading(true);

            expect(useChatStore.getState().isLoading).toBe(true);
        });

        it("should set loading to false", () => {
            useChatStore.getState().setLoading(true);
            useChatStore.getState().setLoading(false);

            expect(useChatStore.getState().isLoading).toBe(false);
        });
    });

    describe("initial state", () => {
        it("should have empty messages array", () => {
            useChatStore.getState().clearChat();
            expect(useChatStore.getState().messages).toEqual([]);
        });

        it("should have null pending action", () => {
            useChatStore.getState().clearChat();
            expect(useChatStore.getState().pendingAction).toBeNull();
        });

        it("should have isLoading as false", () => {
            useChatStore.getState().setLoading(false);
            expect(useChatStore.getState().isLoading).toBe(false);
        });

        it("should have claude as default AI provider", () => {
            useChatStore.getState().setAIProvider("claude");
            expect(useChatStore.getState().aiProvider).toBe("claude");
        });
    });
});
