import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_PERSONALITY, type PersonalityId } from "@/lib/ai/personalities";
import { mcpClient } from "@/lib/mcp-client";
import type { AIProvider } from "@/types/chat";

export type SystemLogKind = "user_edit" | "import" | "undo";

export interface SystemLogEntry {
    id: string;
    createdAt: number;
    text: string;
    slot: number;
    kind: SystemLogKind;
}

// Structural shape for rendered response cards. The full discriminated union
// lives in lib/ai/response-types — chat-store only needs the envelope.
export interface ResponseCardEntry {
    id: string;
    createdAt: number;
    card: unknown;
}

interface ChatState {
    aiProvider: AIProvider;
    personality: PersonalityId;
    queuedPrompt: string | null;
    lastUserPrompt: string | null;
    enableThinking: boolean;
    /** Ephemeral log of manual team edits that get rendered inline in the
     * chat transcript and surfaced to the coach as `recentEdits` context.
     * Never persisted — resets on reload. */
    systemLog: SystemLogEntry[];
    /** Ephemeral structured response cards emitted by the coach via the
     * present_response_card tool. Rendered inline in the transcript. */
    responseCards: ResponseCardEntry[];

    // Actions
    setAIProvider: (provider: AIProvider) => void;
    setPersonality: (personality: PersonalityId) => void;
    clearChat: () => void;
    queuePrompt: (prompt: string) => void;
    clearQueuedPrompt: () => void;
    setLastUserPrompt: (prompt: string) => void;
    toggleThinking: () => void;
    appendSystemLog: (entry: Omit<SystemLogEntry, "id" | "createdAt">) => void;
    clearSystemLog: () => void;
    appendResponseCard: (card: unknown) => void;
    clearResponseCards: () => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set) => ({
            aiProvider: "claude",
            personality: DEFAULT_PERSONALITY,
            queuedPrompt: null,
            lastUserPrompt: null,
            enableThinking: false,
            systemLog: [],
            responseCards: [],

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
                set({ systemLog: [], responseCards: [] });
            },

            queuePrompt: (prompt) => set({ queuedPrompt: prompt }),

            clearQueuedPrompt: () => set({ queuedPrompt: null }),

            setLastUserPrompt: (prompt) => set({ lastUserPrompt: prompt }),

            toggleThinking: () => set((state) => ({ enableThinking: !state.enableThinking })),

            appendSystemLog: (entry) =>
                set((state) => ({
                    systemLog: [
                        ...state.systemLog,
                        {
                            ...entry,
                            id: `sl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                            createdAt: Date.now(),
                        },
                    ],
                })),

            clearSystemLog: () => set({ systemLog: [] }),

            appendResponseCard: (card) =>
                set((state) => ({
                    responseCards: [
                        ...state.responseCards,
                        {
                            id: `rc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                            createdAt: Date.now(),
                            card,
                        },
                    ],
                })),

            clearResponseCards: () => set({ responseCards: [] }),
        }),
        {
            name: "pokemcp-chat",
            version: 1,
            partialize: (state) => ({
                aiProvider: state.aiProvider,
                personality: state.personality,
                enableThinking: state.enableThinking,
            }),
            migrate: (persisted, version) => {
                const state = (persisted ?? {}) as Partial<ChatState>;
                // v0 → v1: retire Professor Kukui as the default. Users who
                // explicitly picked Oak or Blue keep their choice.
                if (version < 1 && state.personality === "kukui") {
                    state.personality = "coach";
                }
                return state as ChatState;
            },
        },
    ),
);
