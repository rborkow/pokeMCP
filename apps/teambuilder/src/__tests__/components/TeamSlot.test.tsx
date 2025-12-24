import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../test-utils";
import { TeamSlot } from "@/components/team/TeamSlot";
import type { TeamPokemon } from "@/types/pokemon";

// Mock the getPokemonTypes function
vi.mock("@/lib/data/pokemon-types", () => ({
    getPokemonTypes: (pokemon: string) => {
        const typeMap: Record<string, string[]> = {
            Garchomp: ["Dragon", "Ground"],
            Pikachu: ["Electric"],
            Charizard: ["Fire", "Flying"],
            Gengar: ["Ghost", "Poison"],
        };
        return typeMap[pokemon] || ["Normal"];
    },
}));

// Mock the toDisplayName function
vi.mock("@/lib/showdown-parser", () => ({
    toDisplayName: (name: string) => name,
}));

describe("TeamSlot", () => {
    const mockPokemon: TeamPokemon = {
        pokemon: "Garchomp",
        nickname: "Chompy",
        item: "Life Orb",
        ability: "Rough Skin",
        moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Stone Edge"],
        teraType: "Steel",
    };

    const defaultProps = {
        pokemon: mockPokemon,
        slot: 0,
        isSelected: false,
        onSelect: vi.fn(),
        onRemove: vi.fn(),
    };

    it("renders Pokemon nickname when provided", () => {
        render(<TeamSlot {...defaultProps} />);
        // Nickname is displayed in curly quotes above the Pokemon name
        expect(screen.getByText(/Chompy/)).toBeInTheDocument();
        // Pokemon name is always shown
        expect(screen.getByText("Garchomp")).toBeInTheDocument();
    });

    it("renders Pokemon name when no nickname", () => {
        const pokemonWithoutNickname = { ...mockPokemon, nickname: undefined };
        render(<TeamSlot {...defaultProps} pokemon={pokemonWithoutNickname} />);
        expect(screen.getByText("Garchomp")).toBeInTheDocument();
    });

    it("displays type badges", () => {
        render(<TeamSlot {...defaultProps} />);
        expect(screen.getByText("Dragon")).toBeInTheDocument();
        expect(screen.getByText("Ground")).toBeInTheDocument();
    });

    it("shows item and ability", () => {
        render(<TeamSlot {...defaultProps} />);
        expect(screen.getByText(/Life Orb/)).toBeInTheDocument();
        expect(screen.getByText(/Rough Skin/)).toBeInTheDocument();
    });

    it("renders all four moves", () => {
        render(<TeamSlot {...defaultProps} />);
        expect(screen.getByText(/Earthquake/)).toBeInTheDocument();
        expect(screen.getByText(/Dragon Claw/)).toBeInTheDocument();
        expect(screen.getByText(/Swords Dance/)).toBeInTheDocument();
        expect(screen.getByText(/Stone Edge/)).toBeInTheDocument();
    });

    it("displays Tera type when provided", () => {
        render(<TeamSlot {...defaultProps} />);
        expect(screen.getByText(/Tera: Steel/)).toBeInTheDocument();
    });

    it("does not show Tera badge when teraType is not set", () => {
        const pokemonWithoutTera = { ...mockPokemon, teraType: undefined };
        render(<TeamSlot {...defaultProps} pokemon={pokemonWithoutTera} />);
        expect(screen.queryByText(/Tera:/)).not.toBeInTheDocument();
    });

    it("calls onSelect when card is clicked", () => {
        const onSelect = vi.fn();
        const { container } = render(<TeamSlot {...defaultProps} onSelect={onSelect} />);

        // Find the card element (has pokemon-card class)
        const card = container.querySelector(".pokemon-card");
        fireEvent.click(card!);
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("calls onRemove when remove button is clicked", () => {
        const onRemove = vi.fn();
        render(<TeamSlot {...defaultProps} onRemove={onRemove} />);

        // Find and click the X button
        const removeButton = screen.getByRole("button");
        fireEvent.click(removeButton);
        expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it("prevents onSelect when clicking remove button", () => {
        const onSelect = vi.fn();
        const onRemove = vi.fn();
        render(<TeamSlot {...defaultProps} onSelect={onSelect} onRemove={onRemove} />);

        const removeButton = screen.getByRole("button");
        fireEvent.click(removeButton);

        expect(onRemove).toHaveBeenCalledTimes(1);
        expect(onSelect).not.toHaveBeenCalled();
    });

    it("applies selected styles when isSelected is true", () => {
        const { container } = render(<TeamSlot {...defaultProps} isSelected={true} />);
        const card = container.querySelector(".border-primary");
        expect(card).toBeInTheDocument();
    });

    it("handles Pokemon with no moves", () => {
        const pokemonNoMoves = { ...mockPokemon, moves: [] };
        render(<TeamSlot {...defaultProps} pokemon={pokemonNoMoves} />);
        // Should not throw and should still render the Pokemon name
        expect(screen.getByText("Garchomp")).toBeInTheDocument();
    });

    it("handles Pokemon with no item", () => {
        const pokemonNoItem = { ...mockPokemon, item: undefined };
        render(<TeamSlot {...defaultProps} pokemon={pokemonNoItem} />);
        expect(screen.getByText(/Rough Skin/)).toBeInTheDocument();
        expect(screen.queryByText(/@ /)).not.toBeInTheDocument();
    });

    it("handles Pokemon with no ability", () => {
        const pokemonNoAbility = { ...mockPokemon, ability: undefined };
        render(<TeamSlot {...defaultProps} pokemon={pokemonNoAbility} />);
        expect(screen.getByText(/Life Orb/)).toBeInTheDocument();
    });

    it("renders without onRemove prop", () => {
        const { onRemove, ...propsWithoutRemove } = defaultProps;
        render(<TeamSlot {...propsWithoutRemove} />);
        // Should not have a remove button
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
});
