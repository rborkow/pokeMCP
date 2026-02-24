import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, TeamAction, AIProvider } from "@/types/chat";
import { type PersonalityId, DEFAULT_PERSONALITY } from "@/lib/ai/personalities";

interface ChatState {
    messages: ChatMessage[];
    pendingAction: TeamAction | null;
    pendingActions: TeamAction[];
    isLoading: boolean;
    aiProvider: AIProvider;
    personality: PersonalityId;
    queuedPrompt: string | null;
    lastUserPrompt: string | null;
    enableThinking: boolean;
    abortController: AbortController | null;

    // Actions
    addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => string;
    updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
    setPendingAction: (action: TeamAction | null) => void;
    setPendingActions: (actions: TeamAction[]) => void;
    advancePendingAction: () => void;
    setAIProvider: (provider: AIProvider) => void;
    setPersonality: (personality: PersonalityId) => void;
    setLoading: (loading: boolean) => void;
    clearChat: () => void;
    removeMessage: (id: string) => void;
    queuePrompt: (prompt: string) => void;
    clearQueuedPrompt: () => void;
    setLastUserPrompt: (prompt: string) => void;
    toggleThinking: () => void;
    startStream: () => AbortController;
    abortStream: () => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set, get) => ({
            messages: [],
            pendingAction: null,
            pendingActions: [],
            isLoading: false,
            aiProvider: "claude",
            personality: DEFAULT_PERSONALITY,
            queuedPrompt: null,
            lastUserPrompt: null,
            enableThinking: false,
            abortController: null,

            addMessage: (message) => {
                const id = crypto.randomUUID();
                const newMessage: ChatMessage = {
                    ...message,
                    id,
                    timestamp: new Date(),
                };
                set((state) => ({
                    messages: [...state.messages, newMessage],
                }));
                return id;
            },

            updateMessage: (id, updates) => {
                set((state) => ({
                    messages: state.messages.map((msg) =>
                        msg.id === id ? { ...msg, ...updates } : msg,
                    ),
                }));
            },

            setPendingAction: (action) => set({ pendingAction: action }),

            setPendingActions: (actions) => {
                if (actions.length === 0) {
                    set({ pendingAction: null, pendingActions: [] });
                    return;
                }
                set({
                    pendingAction: actions[0],
                    pendingActions: actions.slice(1),
                });
            },

            advancePendingAction: () => {
                const { pendingActions } = get();
                if (pendingActions.length === 0) {
                    set({ pendingAction: null, pendingActions: [] });
                    return;
                }
                set({
                    pendingAction: pendingActions[0],
                    pendingActions: pendingActions.slice(1),
                });
            },

            setAIProvider: (provider) => set({ aiProvider: provider }),

            setPersonality: (personality) => set({ personality }),

            setLoading: (loading) => set({ isLoading: loading }),

            clearChat: () => {
                const { abortController } = get();
                if (abortController) {
                    abortController.abort();
                }
                set({
                    messages: [],
                    pendingAction: null,
                    pendingActions: [],
                    isLoading: false,
                    abortController: null,
                });
            },

            removeMessage: (id) => {
                set((state) => ({
                    messages: state.messages.filter((msg) => msg.id !== id),
                }));
            },

            queuePrompt: (prompt) => set({ queuedPrompt: prompt }),

            clearQueuedPrompt: () => set({ queuedPrompt: null }),

            setLastUserPrompt: (prompt) => set({ lastUserPrompt: prompt }),

            toggleThinking: () => set((state) => ({ enableThinking: !state.enableThinking })),

            startStream: () => {
                const { abortController: existing } = get();
                if (existing) {
                    existing.abort();
                }
                const controller = new AbortController();
                set({ abortController: controller, isLoading: true });
                return controller;
            },

            abortStream: () => {
                const { abortController } = get();
                if (abortController) {
                    abortController.abort();
                }
                set({ abortController: null, isLoading: false });
            },
        }),
        {
            name: "pokemcp-chat",
            partialize: (state) => ({
                messages: state.messages,
                aiProvider: state.aiProvider,
                personality: state.personality,
                pendingAction: state.pendingAction,
                enableThinking: state.enableThinking,
            }),
            // Handle Date serialization
            storage: {
                getItem: (name) => {
                    const str = localStorage.getItem(name);
                    if (!str) return null;
                    const data = JSON.parse(str);
                    // Rehydrate Date objects
                    if (data.state?.messages) {
                        data.state.messages = data.state.messages.map((msg: ChatMessage) => ({
                            ...msg,
                            timestamp: new Date(msg.timestamp),
                        }));
                    }
                    return data;
                },
                setItem: (name, value) => {
                    localStorage.setItem(name, JSON.stringify(value));
                },
                removeItem: (name) => {
                    localStorage.removeItem(name);
                },
            },
        },
    ),
);
