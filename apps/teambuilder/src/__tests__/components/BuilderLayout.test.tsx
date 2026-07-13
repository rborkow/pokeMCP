import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuilderLayout } from "@/components/builder/BuilderLayout";
import { useTeamStore } from "@/stores/team-store";
import { render, screen, waitFor } from "../test-utils";

const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

const searchParamsRef = { value: new URLSearchParams() };

vi.mock("next/navigation", () => ({
    useSearchParams: () => searchParamsRef.value,
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    usePathname: () => "/build",
}));

vi.mock("@/components/builder/ChatFirstFrame", () => ({
    ChatFirstFrame: () => <div data-testid="chat-first-frame" />,
}));

vi.mock("@/components/builder/GridFrame", () => ({
    GridFrame: () => <div data-testid="grid-frame" />,
}));

describe("BuilderLayout", () => {
    beforeEach(() => {
        searchParamsRef.value = new URLSearchParams();
        useTeamStore.getState().clearTeam();
        useTeamStore.getState().setUiMode("chat");
        vi.clearAllMocks();
    });

    it("renders the chat-first frame by default", () => {
        render(<BuilderLayout />);
        expect(screen.getByTestId("chat-first-frame")).toBeInTheDocument();
        expect(screen.queryByTestId("grid-frame")).not.toBeInTheDocument();
    });

    it("renders the grid frame when ?mode=grid is in the URL", async () => {
        searchParamsRef.value = new URLSearchParams("mode=grid");
        render(<BuilderLayout />);
        await waitFor(() => {
            expect(screen.getByTestId("grid-frame")).toBeInTheDocument();
        });
        expect(useTeamStore.getState().uiMode).toBe("grid");
    });

    it("renders the chat frame when ?mode=chat is in the URL", async () => {
        useTeamStore.getState().setUiMode("grid");
        searchParamsRef.value = new URLSearchParams("mode=chat");
        render(<BuilderLayout />);
        await waitFor(() => {
            expect(screen.getByTestId("chat-first-frame")).toBeInTheDocument();
        });
        expect(useTeamStore.getState().uiMode).toBe("chat");
    });

    it("respects persisted uiMode when the URL has no mode param", async () => {
        useTeamStore.getState().setUiMode("grid");
        render(<BuilderLayout />);
        await waitFor(() => {
            expect(screen.getByTestId("grid-frame")).toBeInTheDocument();
        });
    });
});
