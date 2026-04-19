import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamGrid } from "@/components/team/TeamGrid";
import { useHistoryStore } from "@/stores/history-store";
import { useTeamStore } from "@/stores/team-store";
import { fireEvent, render, screen } from "../test-utils";

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
        };
        return typeMap[pokemon] || ["Normal"];
    },
}));

// Mock the toDisplayName function
vi.mock("@/lib/showdown-parser", () => ({
    toDisplayName: (name: string) => name,
    parseShowdownTeam: () => [],
    exportShowdownTeam: () => "",
}));

// Mock PokemonEditDialog since it's complex
vi.mock("@/components/team/PokemonEditDialog", () => ({
    PokemonEditDialog: ({ open }: { open: boolean }) =>
        open ? <div data-testid="edit-dialog">Edit Dialog</div> : null,
}));

describe("TeamGrid", () => {
    beforeEach(() => {
        // Reset stores between tests
        useTeamStore.getState().clearTeam();
        useHistoryStore.getState().clearHistory();
        vi.clearAllMocks();
    });

    it("renders 6 slots when team is empty", () => {
        render(<TeamGrid />);
        // All 6 slots should show "Add Pokemon"
        const addButtons = screen.getAllByText("Add Pokemon");
        expect(addButtons).toHaveLength(6);
    });

    it("renders filled slots for Pokemon in team", () => {
        // Add Pokemon to the store
        useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: ["Earthquake"] });
        useTeamStore.getState().setPokemon(1, { pokemon: "Pikachu", moves: ["Thunderbolt"] });

        render(<TeamGrid />);

        expect(screen.getByText("Garchomp")).toBeInTheDocument();
        expect(screen.getByText("Pikachu")).toBeInTheDocument();
        // 4 empty slots remaining
        expect(screen.getAllByText("Add Pokemon")).toHaveLength(4);
    });

    it("shows 6 total slots regardless of team size", () => {
        useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });

        render(<TeamGrid />);

        // 1 filled + 5 empty = 6 total
        expect(screen.getByText("Garchomp")).toBeInTheDocument();
        expect(screen.getAllByText("Add Pokemon")).toHaveLength(5);
    });

    it("opens edit dialog when slot is clicked", () => {
        render(<TeamGrid />);

        // Click the first empty slot button ("Add Pokemon")
        const emptySlots = screen.getAllByRole("button", { name: /Add Pokemon/i });
        fireEvent.click(emptySlots[0]);

        expect(screen.getByTestId("edit-dialog")).toBeInTheDocument();
    });

    it("opens edit dialog when filled slot is clicked", () => {
        useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });

        render(<TeamGrid />);

        // Click the filled Pokemon card
        const card = screen.getByRole("button", { name: /Click to edit/i });
        fireEvent.click(card);

        expect(screen.getByTestId("edit-dialog")).toBeInTheDocument();
    });

    it("calls onSlotClick callback when provided", () => {
        const onSlotClick = vi.fn();
        render(<TeamGrid onSlotClick={onSlotClick} />);

        // Click an empty slot
        const emptySlots = screen.getAllByRole("button", { name: /Add Pokemon/i });
        fireEvent.click(emptySlots[0]);

        expect(onSlotClick).toHaveBeenCalledWith(0);
    });

    it("renders Pokemon with correct type badges", () => {
        useTeamStore.getState().setPokemon(0, { pokemon: "Charizard", moves: [] });

        render(<TeamGrid />);

        expect(screen.getByText("Fire")).toBeInTheDocument();
        expect(screen.getByText("Flying")).toBeInTheDocument();
    });

    it("handles full team of 6 Pokemon", () => {
        for (let i = 0; i < 6; i++) {
            useTeamStore.getState().setPokemon(i, { pokemon: `Pokemon${i}`, moves: [] });
        }

        render(<TeamGrid />);

        // No empty slots should be shown
        expect(screen.queryByText("Add Pokemon")).not.toBeInTheDocument();
    });

    it("uses grid layout for slots", () => {
        const { container } = render(<TeamGrid />);
        const grid = container.querySelector(".grid");
        expect(grid).toBeInTheDocument();
        expect(grid).toHaveClass("grid-cols-2");
    });
});
