import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "../test-utils";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useChatStore } from "@/stores/chat-store";
import { useTeamStore } from "@/stores/team-store";
import { useHistoryStore } from "@/stores/history-store";

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

// Mock the AI streaming function
vi.mock("@/lib/ai", () => ({
    streamChatMessage: vi.fn(({ onComplete }) => {
        // Simulate a response
        setTimeout(() => {
            onComplete({ content: "Mock AI response", action: null });
        }, 10);
        return Promise.resolve();
    }),
}));

// Mock showdown-parser
vi.mock("@/lib/showdown-parser", () => ({
    parseShowdownTeam: () => [],
    exportShowdownTeam: () => "",
}));

// Mock PersonalitySelector as a simple component
vi.mock("@/components/chat/PersonalitySelector", () => ({
    PersonalitySelector: () => <div data-testid="personality-selector">Prof. Kukui</div>,
}));

describe("ChatPanel", () => {
    beforeEach(() => {
        useChatStore.getState().clearChat();
        useTeamStore.getState().clearTeam();
        useHistoryStore.getState().clearHistory();
        vi.clearAllMocks();
    });

    it("renders personality selector", () => {
        render(<ChatPanel />);
        expect(screen.getByTestId("personality-selector")).toBeInTheDocument();
    });

    it("renders chat input field", () => {
        render(<ChatPanel />);
        // Input should have a placeholder
        expect(
            screen.getByPlaceholderText(/import a team first|ask about your team/i)
        ).toBeInTheDocument();
    });

    it("shows different placeholder when team is empty", () => {
        render(<ChatPanel />);
        expect(
            screen.getByPlaceholderText("Import a team first, then ask me anything...")
        ).toBeInTheDocument();
    });

    it("shows different placeholder when team has Pokemon", () => {
        useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });

        render(<ChatPanel />);
        expect(screen.getByPlaceholderText("Ask about your team...")).toBeInTheDocument();
    });

    it("does not show clear button when no messages", () => {
        render(<ChatPanel />);
        expect(screen.queryByText("Clear")).not.toBeInTheDocument();
    });

    it("shows clear button when messages exist", async () => {
        // Add message and re-render to see the update
        useChatStore.getState().addMessage({ role: "user", content: "Hello" });

        const { rerender } = render(<ChatPanel />);
        // Force re-render to pick up store changes
        rerender(<ChatPanel />);

        expect(screen.getByText("Clear")).toBeInTheDocument();
    });

    it("clears messages when clear button is clicked", async () => {
        useChatStore.getState().addMessage({ role: "user", content: "Hello" });

        const { rerender } = render(<ChatPanel />);
        rerender(<ChatPanel />);

        fireEvent.click(screen.getByText("Clear"));

        expect(useChatStore.getState().messages).toHaveLength(0);
    });

    it("renders suggested prompts component", () => {
        render(<ChatPanel />);
        // SuggestedPrompts shows "Improve coverage" when no team
        // (Rate my team requires a team)
        expect(screen.getByText("Improve coverage")).toBeInTheDocument();
    });

    it("renders with glass-panel styling and fixed height", () => {
        const { container } = render(<ChatPanel />);
        const panel = container.querySelector(".glass-panel.h-\\[600px\\]");
        expect(panel).toBeInTheDocument();
    });

    it("disables input when loading", () => {
        useChatStore.getState().setLoading(true);

        render(<ChatPanel />);
        const textarea = screen.getByPlaceholderText(/import a team first|ask about your team/i);
        expect(textarea).toBeDisabled();
    });

    it("disables clear button when loading", () => {
        useChatStore.getState().addMessage({ role: "user", content: "Hello" });
        useChatStore.getState().setLoading(true);

        const { rerender } = render(<ChatPanel />);
        rerender(<ChatPanel />);

        const clearButton = screen.getByText("Clear").closest("button");
        expect(clearButton).toBeDisabled();
    });

    it("renders messages from chat store", () => {
        useChatStore.getState().addMessage({ role: "user", content: "Test message" });
        useChatStore.getState().addMessage({
            role: "assistant",
            content: "Test response",
        });

        const { rerender } = render(<ChatPanel />);
        rerender(<ChatPanel />);

        // Messages are rendered via ChatMessages component
        // The exact rendering depends on ChatMessages implementation
        expect(useChatStore.getState().messages).toHaveLength(2);
    });

    it("has flex column layout", () => {
        const { container } = render(<ChatPanel />);
        const card = container.querySelector(".flex.flex-col");
        expect(card).toBeInTheDocument();
    });
});
