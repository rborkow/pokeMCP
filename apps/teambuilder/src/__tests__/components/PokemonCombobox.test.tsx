import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PokemonCombobox } from "@/components/team/PokemonCombobox";

// Stub out useLegalPokemon — we test grouping separately in Task 10.
vi.mock("@/lib/mcp-client", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@/lib/mcp-client");
    return {
        ...actual,
        useLegalPokemon: () => ({ data: undefined, isLoading: false }),
    };
});

function renderWithClient(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("PokemonCombobox", () => {
    it("renders the current value in the trigger input", () => {
        renderWithClient(
            <PokemonCombobox value="Pikachu" onChange={() => {}} format="gen9ou" />,
        );
        expect(screen.getByDisplayValue("Pikachu")).toBeInTheDocument();
    });

    it("opens the popover on focus and shows suggestions", () => {
        renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        // When open with empty query, the list should render many items; check one
        // reliable option is present.
        expect(screen.getByText("Pikachu")).toBeInTheDocument();
    });

    it("substring-filters suggestions", () => {
        renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "therian" } });
        expect(screen.getByText("Landorus-Therian")).toBeInTheDocument();
        expect(screen.queryByText("Pikachu")).not.toBeInTheDocument();
    });

    it("calls onChange with the canonical display name when a suggestion is clicked", () => {
        const onChange = vi.fn();
        renderWithClient(<PokemonCombobox value="" onChange={onChange} format="gen9ou" />);
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "landorus-th" } });
        fireEvent.click(screen.getByText("Landorus-Therian"));
        expect(onChange).toHaveBeenCalledWith("Landorus-Therian");
    });

    it("shows an empty state when no suggestions match", () => {
        renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "zzzzzzz" } });
        expect(screen.getByText(/No Pokémon match/i)).toBeInTheDocument();
    });

    it("renders a sprite next to each suggestion", () => {
        renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "pikachu" } });
        // PokemonSprite renders an <img alt={pokemon}> inside each option.
        expect(screen.getByAltText("Pikachu")).toBeInTheDocument();
    });
});
