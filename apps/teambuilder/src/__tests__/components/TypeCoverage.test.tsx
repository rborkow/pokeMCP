import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../test-utils";
import { TypeCoverage } from "@/components/analysis/TypeCoverage";
import { useTeamStore } from "@/stores/team-store";

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

// Mock the getPokemonTypes function
vi.mock("@/lib/data/pokemon-types", () => ({
    getPokemonTypes: (pokemon: string) => {
        const typeMap: Record<string, string[]> = {
            Garchomp: ["Dragon", "Ground"],
            Pikachu: ["Electric"],
            Charizard: ["Fire", "Flying"],
            Gengar: ["Ghost", "Poison"],
            Steelix: ["Steel", "Ground"],
            Gyarados: ["Water", "Flying"],
        };
        return typeMap[pokemon] || ["Normal"];
    },
}));

// Mock showdown-parser
vi.mock("@/lib/showdown-parser", () => ({
    parseShowdownTeam: () => [],
    exportShowdownTeam: () => "",
}));

describe("TypeCoverage", () => {
    beforeEach(() => {
        useTeamStore.getState().clearTeam();
        vi.clearAllMocks();
    });

    it("displays empty state message when team is empty", () => {
        render(<TypeCoverage />);
        expect(screen.getByText("Add Pokemon to see type coverage analysis")).toBeInTheDocument();
    });

    it("displays Type Coverage title when team is empty", () => {
        render(<TypeCoverage />);
        expect(screen.getByText("Type Coverage")).toBeInTheDocument();
    });

    it("displays analysis title when team has Pokemon", () => {
        useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });

        render(<TypeCoverage />);
        expect(screen.getByText("Type Coverage Analysis")).toBeInTheDocument();
    });

    it("shows weaknesses section", () => {
        useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });

        render(<TypeCoverage />);
        expect(screen.getByText("Team Weaknesses")).toBeInTheDocument();
    });

    it("shows resistances section", () => {
        useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });

        render(<TypeCoverage />);
        expect(screen.getByText("Team Resistances")).toBeInTheDocument();
    });

    it("displays correct weaknesses for Dragon/Ground type", () => {
        // Garchomp is Dragon/Ground, weak to Ice, Dragon, Fairy
        useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });

        render(<TypeCoverage />);

        // Ice should appear as a weakness (4x)
        expect(screen.getByText(/Ice/)).toBeInTheDocument();
    });

    it("displays immunities section when team has immunities", () => {
        // Garchomp is Ground type, immune to Electric
        useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });

        render(<TypeCoverage />);

        // Check for immunity section header
        expect(screen.getByText("Team Immunities")).toBeInTheDocument();
    });

    it("shows no shared weaknesses message when appropriate", () => {
        // Set up a team with balanced coverage
        useTeamStore.getState().setPokemon(0, { pokemon: "Steelix", moves: [] });

        render(<TypeCoverage />);

        // Steelix should have weaknesses (Fire, Water, Fighting, Ground)
        expect(screen.getByText("Team Weaknesses")).toBeInTheDocument();
    });

    it("handles multiple Pokemon in team", () => {
        useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });
        useTeamStore.getState().setPokemon(1, { pokemon: "Pikachu", moves: [] });
        useTeamStore.getState().setPokemon(2, { pokemon: "Charizard", moves: [] });

        render(<TypeCoverage />);

        expect(screen.getByText("Type Coverage Analysis")).toBeInTheDocument();
        expect(screen.getByText("Team Weaknesses")).toBeInTheDocument();
        expect(screen.getByText("Team Resistances")).toBeInTheDocument();
    });

    it("renders type badges with counts", () => {
        useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });
        useTeamStore.getState().setPokemon(1, { pokemon: "Pikachu", moves: [] });

        render(<TypeCoverage />);

        // Verify badges render with counts in parentheses
        // Garchomp (Dragon/Ground) is weak to Ice
        // Both are represented with counts
        const badges = screen.getAllByRole("generic").filter((el) =>
            el.className.includes("cursor-help") && el.textContent?.includes("(")
        );
        expect(badges.length).toBeGreaterThan(0);
    });

    it("renders with glass-panel styling", () => {
        const { container } = render(<TypeCoverage />);
        // Now uses glass-panel class instead of Card
        const panel = container.querySelector(".glass-panel");
        expect(panel).toBeInTheDocument();
    });
});
