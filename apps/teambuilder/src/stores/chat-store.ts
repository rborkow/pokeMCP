import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, TeamAction, AIProvider } from "@/types/chat";
import { type PersonalityId, DEFAULT_PERSONALITY } from "@/lib/ai/personalities";

interface ChatState {
  messages: ChatMessage[];
  pendingAction: TeamAction | null;
  isLoading: boolean;
  aiProvider: AIProvider;
  personality: PersonalityId;

  // Actions
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setPendingAction: (action: TeamAction | null) => void;
  setAIProvider: (provider: AIProvider) => void;
  setPersonality: (personality: PersonalityId) => void;
  setLoading: (loading: boolean) => void;
  clearChat: () => void;
  removeMessage: (id: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      pendingAction: null,
      isLoading: false,
      aiProvider: "claude",
      personality: DEFAULT_PERSONALITY,

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
          messages: state.messages.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)),
        }));
      },

      setPendingAction: (action) => set({ pendingAction: action }),

      setAIProvider: (provider) => set({ aiProvider: provider }),

      setPersonality: (personality) => set({ personality }),

      setLoading: (loading) => set({ isLoading: loading }),

      clearChat: () => set({ messages: [], pendingAction: null }),

      removeMessage: (id) => {
        set((state) => ({
          messages: state.messages.filter((msg) => msg.id !== id),
        }));
      },
    }),
    {
      name: "pokemcp-chat",
      partialize: (state) => ({
        messages: state.messages,
        aiProvider: state.aiProvider,
        personality: state.personality,
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
    }
  )
);
