import { create } from "zustand";
import type { ChatMessage, TeamAction, AIProvider } from "@/types/chat";

interface ChatState {
  messages: ChatMessage[];
  pendingAction: TeamAction | null;
  isLoading: boolean;
  aiProvider: AIProvider;

  // Actions
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  setPendingAction: (action: TeamAction | null) => void;
  setAIProvider: (provider: AIProvider) => void;
  setLoading: (loading: boolean) => void;
  clearChat: () => void;
  removeMessage: (id: string) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  pendingAction: null,
  isLoading: false,
  aiProvider: "cloudflare",

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

  setLoading: (loading) => set({ isLoading: loading }),

  clearChat: () => set({ messages: [], pendingAction: null }),

  removeMessage: (id) => {
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== id),
    }));
  },
}));
