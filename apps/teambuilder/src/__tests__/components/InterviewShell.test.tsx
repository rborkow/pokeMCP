import { beforeEach, describe, expect, it, vi } from "vitest";
import { InterviewShell } from "@/components/interview/InterviewShell";
import { useInterviewStore } from "@/stores/interview-store";
import { useTeamStore } from "@/stores/team-store";
import { fireEvent, render, screen, waitFor } from "../test-utils";

const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

// next/navigation is used transitively by FormatSelector → nothing to mock here.
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/builder",
}));

describe("InterviewShell", () => {
    beforeEach(() => {
        useInterviewStore.getState().reset();
        useTeamStore.getState().clearTeam();
        useTeamStore.getState().setFormat("gen9ou");
        vi.clearAllMocks();
    });

    it("renders step 1 progress and the format question on mount", async () => {
        render(<InterviewShell />);
        await waitFor(() => {
            expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/Which format are we building for/i)).toBeInTheDocument();
    });

    it("advances to step 2 (Starting point) when Next is clicked", async () => {
        render(<InterviewShell />);
        await waitFor(() => expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: /Next/i }));

        await waitFor(() => expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument());
        expect(screen.getByText(/Where do you want to start/i)).toBeInTheDocument();
    });

    it("Escape key triggers skip()", async () => {
        render(<InterviewShell />);
        await waitFor(() => expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument());

        fireEvent.keyDown(window, { key: "Escape" });
        await waitFor(() => expect(useInterviewStore.getState().status).toBe("skipped"));
    });
});
