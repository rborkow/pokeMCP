import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

    afterEach(() => {
        vi.unstubAllGlobals();
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

    it("includes the just-submitted final (preferences) answer in the synthesis request", async () => {
        // Regression test: runSynthesis used to read `answers` from the render
        // closure, so the preferences answer submitted on the final step —
        // which triggers runSynthesis synchronously — was dropped from the
        // POST body.
        const mockFetch = vi
            .fn()
            .mockResolvedValue({ ok: true, body: null } as unknown as Response);
        vi.stubGlobal("fetch", mockFetch);

        render(<InterviewShell />);

        // Step 1: format — Next is always enabled regardless of hasAnswer.
        await waitFor(() => expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: /Next/i }));

        // Step 2: starting point — pick a choice to enable Next.
        await waitFor(() => expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument());
        fireEvent.click(screen.getByText("Clean slate"));
        fireEvent.click(screen.getByRole("button", { name: /Next/i }));

        // Step 3: playstyle — pick a choice to enable Next.
        await waitFor(() => expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument());
        fireEvent.click(screen.getByText("Balance"));
        fireEvent.click(screen.getByRole("button", { name: /Next/i }));

        // Step 4: preferences — the final step. Submitting it fires runSynthesis
        // synchronously, before this component would otherwise re-render with
        // the updated `answers` from the store.
        await waitFor(() => expect(screen.getByText(/Step 4 of 4/i)).toBeInTheDocument());
        fireEvent.change(screen.getByPlaceholderText(/Dragapult/i), {
            target: { value: "I want Dragapult, no legendaries" },
        });
        fireEvent.click(screen.getByRole("button", { name: /Next/i }));

        await waitFor(() => expect(mockFetch).toHaveBeenCalled());
        const [, init] = mockFetch.mock.calls[0];
        const body = JSON.parse((init as RequestInit).body as string);
        expect(body.answers.preferences).toBe("I want Dragapult, no legendaries");
    });
});
