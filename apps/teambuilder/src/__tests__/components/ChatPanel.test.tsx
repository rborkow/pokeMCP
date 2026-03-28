import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../test-utils";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useChatStore } from "@/stores/chat-store";
import { useTeamStore } from "@/stores/team-store";
import { useHistoryStore } from "@/stores/history-store";

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
    randomUUID: () => `test-uuid-${Date.now()}-${Math.random()}`,
});

// Mock useChat from TanStack AI
const mockSendMessage = vi.fn();
const mockStop = vi.fn();
const mockClear = vi.fn();
const mockSetMessages = vi.fn();

vi.mock("@tanstack/ai-react", () => ({
    useChat: vi.fn(() => ({
        messages: [],
        sendMessage: mockSendMessage,
        stop: mockStop,
        clear: mockClear,
        isLoading: false,
        status: "ready" as const,
        error: undefined,
        setMessages: mockSetMessages,
    })),
}));

// Mock connection and tools
vi.mock("@/lib/ai/connection", () => ({
    createPokemonChatConnection: vi.fn(() => ({
        connect: vi.fn(),
    })),
}));

vi.mock("@/lib/ai/tools-tanstack", () => ({
    modifyTeamTool: {
        name: "modify_team",
        description: "Modify team",
        inputSchema: { type: "object", properties: {} },
        needsApproval: true,
    },
}));

vi.mock("@/lib/ai/parse-tool-action", () => ({
    parseToolToAction: vi.fn(),
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
        localStorageMock.getItem.mockReturnValue(null);
    });

    it("renders personality selector", () => {
        render(<ChatPanel />);
        expect(screen.getByTestId("personality-selector")).toBeInTheDocument();
    });

    it("renders chat input field", () => {
        render(<ChatPanel />);
        expect(
            screen.getByPlaceholderText(/import a team first|ask about your team/i),
        ).toBeInTheDocument();
    });

    it("shows different placeholder when team is empty", () => {
        render(<ChatPanel />);
        expect(
            screen.getByPlaceholderText("Import a team first, then ask me anything..."),
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

    it("renders suggested prompts component", () => {
        render(<ChatPanel />);
        // SuggestedPrompts shows "Improve coverage" when no team
        expect(screen.getByText("Improve coverage")).toBeInTheDocument();
    });

    it("renders with glass-panel styling", () => {
        const { container } = render(<ChatPanel />);
        const panel = container.querySelector(".glass-panel");
        expect(panel).toBeInTheDocument();
    });

    it("has flex column layout", () => {
        const { container } = render(<ChatPanel />);
        const card = container.querySelector(".flex.flex-col");
        expect(card).toBeInTheDocument();
    });

    it("renders empty state when no messages", () => {
        render(<ChatPanel />);
        expect(screen.getByText("Ask me anything about your team!")).toBeInTheDocument();
    });
});
