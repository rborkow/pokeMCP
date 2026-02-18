import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "../test-utils";
import { SharedTeamView } from "@/app/t/[id]/SharedTeamView";
import { useTeamStore } from "@/stores/team-store";
import type { SharedTeam } from "@/lib/share-api";

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
}));

// Mock showdown-parser
vi.mock("@/lib/showdown-parser", () => ({
    exportShowdownTeam: vi.fn(() => "Garchomp @ Life Orb\nAbility: Rough Skin\n- Earthquake"),
}));

// Mock PokemonSprite
vi.mock("@/components/team/PokemonSprite", () => ({
    PokemonSprite: ({ pokemon }: { pokemon: string }) => (
        <div data-testid={`sprite-${pokemon}`}>{pokemon}</div>
    ),
}));

const sharedTeam: SharedTeam = {
    id: "abc123",
    format: "gen9ou",
    createdAt: "2026-01-15T12:00:00Z",
    team: [
        {
            pokemon: "Garchomp",
            moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Fire Fang"],
            item: "Life Orb",
            ability: "Rough Skin",
            nature: "Jolly",
            teraType: "Steel",
        },
        {
            pokemon: "Landorus-Therian",
            moves: ["U-turn", "Earthquake"],
            item: "Choice Scarf",
            ability: "Intimidate",
        },
    ],
};

describe("SharedTeamView", () => {
    beforeEach(() => {
        useTeamStore.getState().clearTeam();
        vi.clearAllMocks();
    });

    it("displays the format name", () => {
        render(<SharedTeamView team={sharedTeam} />);
        expect(screen.getByText("Gen 9 OU")).toBeInTheDocument();
    });

    it("displays the Pokemon count", () => {
        render(<SharedTeamView team={sharedTeam} />);
        expect(screen.getByText("2 Pokemon")).toBeInTheDocument();
    });

    it("renders each Pokemon's name in a heading", () => {
        render(<SharedTeamView team={sharedTeam} />);
        const headings = screen.getAllByRole("heading", { level: 3 });
        const names = headings.map((h) => h.textContent);
        expect(names).toContain("Garchomp");
        expect(names).toContain("Landorus-Therian");
    });

    it("displays items when present", () => {
        render(<SharedTeamView team={sharedTeam} />);
        expect(screen.getByText("Life Orb")).toBeInTheDocument();
        expect(screen.getByText("Choice Scarf")).toBeInTheDocument();
    });

    it("displays abilities when present", () => {
        render(<SharedTeamView team={sharedTeam} />);
        expect(screen.getByText("Rough Skin")).toBeInTheDocument();
        expect(screen.getByText("Intimidate")).toBeInTheDocument();
    });

    it("displays moves for each Pokemon", () => {
        render(<SharedTeamView team={sharedTeam} />);
        // Earthquake appears twice (Garchomp + Landorus-Therian)
        expect(screen.getAllByText("Earthquake")).toHaveLength(2);
        expect(screen.getByText("Dragon Claw")).toBeInTheDocument();
        expect(screen.getByText("Swords Dance")).toBeInTheDocument();
        expect(screen.getByText("Fire Fang")).toBeInTheDocument();
        expect(screen.getByText("U-turn")).toBeInTheDocument();
    });

    it("displays nature when present", () => {
        render(<SharedTeamView team={sharedTeam} />);
        expect(screen.getByText("Jolly")).toBeInTheDocument();
    });

    it("displays tera type when present", () => {
        render(<SharedTeamView team={sharedTeam} />);
        expect(screen.getByText("Tera: Steel")).toBeInTheDocument();
    });

    it("renders sprites for each Pokemon", () => {
        render(<SharedTeamView team={sharedTeam} />);
        expect(screen.getByTestId("sprite-Garchomp")).toBeInTheDocument();
        expect(screen.getByTestId("sprite-Landorus-Therian")).toBeInTheDocument();
    });

    describe("Load into Builder", () => {
        it("renders the button", () => {
            render(<SharedTeamView team={sharedTeam} />);
            expect(screen.getByText("Load into Builder")).toBeInTheDocument();
        });

        it("clears team, sets format, imports, and navigates on click", () => {
            render(<SharedTeamView team={sharedTeam} />);
            fireEvent.click(screen.getByText("Load into Builder"));

            // After click, the store should have been modified and router pushed
            expect(mockPush).toHaveBeenCalledWith("/");
            // The store should have the format set
            expect(useTeamStore.getState().format).toBe("gen9ou");
        });
    });
});
