import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "../test-utils";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useChatStore } from "@/stores/chat-store";
import { useTeamStore } from "@/stores/team-store";
import { useHistoryStore } from "@/stores/history-store";
import * as parseToolActionModule from "@/lib/ai/parse-tool-action";

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
let mockUseChatState: {
    messages: Array<{
        id: string;
        role: "user" | "assistant" | "system";
        parts: Array<{ type: string; content?: string }>;
        createdAt?: Date;
    }>;
    isLoading: boolean;
    status: "ready" | "submitted" | "streaming" | "error";
} = {
    messages: [],
    isLoading: false,
    status: "ready",
};
let latestUseChatOptions: { onChunk?: (chunk: unknown) => void } | null = null;

vi.mock("@tanstack/ai-react", () => ({
    useChat: vi.fn((options?: { onChunk?: (chunk: unknown) => void }) => {
        latestUseChatOptions = options ?? null;
        return {
            messages: mockUseChatState.messages,
            sendMessage: mockSendMessage,
            stop: mockStop,
            clear: mockClear,
            isLoading: mockUseChatState.isLoading,
            status: mockUseChatState.status,
            error: undefined,
            setMessages: mockSetMessages,
        };
    }),
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

vi.mock("@/lib/ai/parse-tool-action", async () => {
    const actual = await vi.importActual<typeof import("@/lib/ai/parse-tool-action")>(
        "@/lib/ai/parse-tool-action",
    );
    return actual;
});

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
        mockUseChatState = {
            messages: [],
            isLoading: false,
            status: "ready",
        };
        latestUseChatOptions = null;
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
        expect(screen.getByText(/Ready when you are/i)).toBeInTheDocument();
    });

    it("renders active assistant text from chunks before messages update", async () => {
        render(<ChatPanel />);

        expect(latestUseChatOptions?.onChunk).toBeDefined();

        act(() => {
            mockUseChatState.isLoading = true;
            latestUseChatOptions?.onChunk?.({
                type: "RUN_STARTED",
                timestamp: Date.now(),
            });
            latestUseChatOptions?.onChunk?.({
                type: "TEXT_MESSAGE_CONTENT",
                messageId: "assistant-1",
                delta: "Hello smooth world",
                timestamp: Date.now(),
            });
        });

        await waitFor(() => {
            expect(screen.getByTestId("live-assistant-message")).toBeInTheDocument();
            expect(screen.getByText("Hello smooth world")).toBeInTheDocument();
        });
    });

    it("defers tool approvals until the stream completes", async () => {
        const parseSpy = vi.spyOn(parseToolActionModule, "parseToolToAction");
        const teamAction = {
            type: "add_pokemon" as const,
            slot: 0,
            payload: { pokemon: "Garchomp", moves: ["Earthquake"] },
            preview: [{ pokemon: "Garchomp", moves: ["Earthquake"] }],
            reason: "Add a strong lead",
        };
        parseSpy.mockReturnValue(
            teamAction as ReturnType<typeof parseToolActionModule.parseToolToAction>,
        );

        const { rerender } = render(<ChatPanel />);

        act(() => {
            mockUseChatState.isLoading = true;
            latestUseChatOptions?.onChunk?.({
                type: "RUN_STARTED",
                timestamp: Date.now(),
            });
            latestUseChatOptions?.onChunk?.({
                type: "TEXT_MESSAGE_CONTENT",
                messageId: "assistant-2",
                delta: "Let me suggest a lead.",
                timestamp: Date.now(),
            });
            latestUseChatOptions?.onChunk?.({
                type: "TOOL_CALL_END",
                input: {
                    action_type: "add_pokemon",
                    slot: 0,
                    reason: "Add a strong lead",
                    pokemon: "Garchomp",
                    moves: ["Earthquake"],
                },
                timestamp: Date.now(),
            });
        });

        await waitFor(() => {
            expect(screen.getByText("Let me suggest a lead.")).toBeInTheDocument();
        });
        expect(screen.queryByText("Add Pokemon")).not.toBeInTheDocument();

        act(() => {
            mockUseChatState = {
                messages: [
                    {
                        id: "assistant-2",
                        role: "assistant",
                        parts: [{ type: "text", content: "Let me suggest a lead." }],
                        createdAt: new Date(),
                    },
                ],
                isLoading: false,
                status: "ready",
            };
            latestUseChatOptions?.onChunk?.({
                type: "RUN_FINISHED",
                timestamp: Date.now(),
            });
        });

        rerender(<ChatPanel />);

        await waitFor(() => {
            expect(screen.getByText("Add Pokemon")).toBeInTheDocument();
        });
    });
});
