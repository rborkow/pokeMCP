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
    // Reset store between tests
    useChatStore.getState().clearChat();
    useChatStore.getState().setPersonality(DEFAULT_PERSONALITY);
    useChatStore.getState().setLoading(false);
    vi.clearAllMocks();
  });

  describe("messages", () => {
    it("should start with empty messages", () => {
      expect(useChatStore.getState().messages).toHaveLength(0);
    });

    it("should add a message and return its id", () => {
      const id = useChatStore.getState().addMessage({
        role: "user",
        content: "Hello",
      });

      expect(id).toBeTruthy();
      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().messages[0].content).toBe("Hello");
    });

    it("should add timestamp to messages", () => {
      useChatStore.getState().addMessage({
        role: "user",
        content: "Test",
      });

      const message = useChatStore.getState().messages[0];
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    it("should update a message by id", () => {
      const id = useChatStore.getState().addMessage({
        role: "assistant",
        content: "Original",
      });

      useChatStore.getState().updateMessage(id, { content: "Updated" });

      expect(useChatStore.getState().messages[0].content).toBe("Updated");
    });

    it("should remove a message by id", () => {
      const id = useChatStore.getState().addMessage({
        role: "user",
        content: "To be removed",
      });

      useChatStore.getState().removeMessage(id);

      expect(useChatStore.getState().messages).toHaveLength(0);
    });
  });

  describe("clearChat", () => {
    it("should clear all messages", () => {
      useChatStore.getState().addMessage({ role: "user", content: "1" });
      useChatStore.getState().addMessage({ role: "assistant", content: "2" });

      useChatStore.getState().clearChat();

      expect(useChatStore.getState().messages).toHaveLength(0);
    });

    it("should clear pending action", () => {
      useChatStore.getState().setPendingAction({
        type: "add_pokemon",
        slot: 0,
        payload: { pokemon: "Garchomp" },
        preview: [],
        reason: "Test",
      });

      useChatStore.getState().clearChat();

      expect(useChatStore.getState().pendingAction).toBeNull();
    });
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

  describe("loading state", () => {
    it("should default to not loading", () => {
      expect(useChatStore.getState().isLoading).toBe(false);
    });

    it("should set loading state", () => {
      useChatStore.getState().setLoading(true);

      expect(useChatStore.getState().isLoading).toBe(true);
    });
  });

  describe("pendingAction", () => {
    it("should default to null", () => {
      expect(useChatStore.getState().pendingAction).toBeNull();
    });

    it("should set pending action", () => {
      const action = {
        type: "add_pokemon" as const,
        slot: 0,
        payload: { pokemon: "Garchomp" },
        preview: [{ pokemon: "Garchomp", moves: [] }],
        reason: "Test action",
      };

      useChatStore.getState().setPendingAction(action);

      expect(useChatStore.getState().pendingAction).toEqual(action);
    });

    it("should clear pending action", () => {
      useChatStore.getState().setPendingAction({
        type: "add_pokemon",
        slot: 0,
        payload: {},
        preview: [],
        reason: "Test",
      });

      useChatStore.getState().setPendingAction(null);

      expect(useChatStore.getState().pendingAction).toBeNull();
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
