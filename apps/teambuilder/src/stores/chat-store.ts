import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIProvider } from "@/types/chat";
import { type PersonalityId, DEFAULT_PERSONALITY } from "@/lib/ai/personalities";
import { mcpClient } from "@/lib/mcp-client";

interface ChatState {
    aiProvider: AIProvider;
    personality: PersonalityId;
    queuedPrompt: string | null;
    lastUserPrompt: string | null;
    enableThinking: boolean;

    // Actions
    setAIProvider: (provider: AIProvider) => void;
    setPersonality: (personality: PersonalityId) => void;
    clearChat: () => void;
    queuePrompt: (prompt: string) => void;
    clearQueuedPrompt: () => void;
    setLastUserPrompt: (prompt: string) => void;
    toggleThinking: () => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set) => ({
            aiProvider: "claude",
            personality: DEFAULT_PERSONALITY,
            queuedPrompt: null,
            lastUserPrompt: null,
            enableThinking: false,

            setAIProvider: (provider) => set({ aiProvider: provider }),

            setPersonality: (personality) => set({ personality }),

            clearChat: () => {
                // Reset MCP session so new conversations get a fresh session ID
                mcpClient.resetSession();
                // Clear persisted chat messages (managed by useChat in ChatPanel)
                try {
                    localStorage.removeItem("pokemcp-chat-messages");
                } catch {
                    // ignore
                }
            },

            queuePrompt: (prompt) => set({ queuedPrompt: prompt }),

            clearQueuedPrompt: () => set({ queuedPrompt: null }),

            setLastUserPrompt: (prompt) => set({ lastUserPrompt: prompt }),

            toggleThinking: () => set((state) => ({ enableThinking: !state.enableThinking })),
        }),
        {
            name: "pokemcp-chat",
            partialize: (state) => ({
                aiProvider: state.aiProvider,
                personality: state.personality,
                enableThinking: state.enableThinking,
            }),
        },
    ),
);
