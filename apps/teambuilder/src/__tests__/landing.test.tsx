import { beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "@/app/page";
import { useTeamStore } from "@/stores/team-store";
import { render, screen, waitFor } from "./test-utils";

const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

describe("LandingPage", () => {
    beforeEach(() => {
        useTeamStore.getState().clearTeam();
        vi.clearAllMocks();
    });

    it("renders the hero, CTAs, and supporting sections", () => {
        render(<LandingPage />);

        expect(
            screen.getByRole("heading", {
                name: /A coach for the whole build/i,
            }),
        ).toBeInTheDocument();

        const interviewCTA = screen.getByRole("link", { name: /Start the interview/i });
        expect(interviewCTA).toHaveAttribute("href", "/builder?start=interview");

        const importCTA = screen.getByRole("link", { name: /Import from Showdown/i });
        expect(importCTA).toHaveAttribute("href", "/builder?start=import");

        const emptyCTA = screen.getByRole("link", { name: /Open empty builder/i });
        expect(emptyCTA).toHaveAttribute("href", "/builder?start=empty");

        expect(screen.getByText(/The coach shows up at every step/i)).toBeInTheDocument();
        expect(screen.getByText(/Built on Model Context Protocol/i)).toBeInTheDocument();
    });

    it("does not redirect when no team is saved", async () => {
        render(<LandingPage />);
        // Wait long enough for hydration effect to settle.
        await waitFor(() => {
            expect(mockReplace).not.toHaveBeenCalled();
        });
    });

    it("redirects to /builder when a team is already persisted", async () => {
        useTeamStore.getState().setPokemon(0, {
            pokemon: "Garchomp",
            moves: ["Earthquake"],
        });

        render(<LandingPage />);

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith("/builder");
        });
    });
});
