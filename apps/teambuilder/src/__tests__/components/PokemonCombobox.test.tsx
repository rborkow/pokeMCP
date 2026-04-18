import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PokemonCombobox } from "@/components/team/PokemonCombobox";

const legalPokemonStub: { data: Set<string> | undefined; isLoading: boolean } = {
    data: undefined,
    isLoading: false,
};
vi.mock("@/lib/mcp-client", async () => {
    const actual = await vi.importActual<Record<string, unknown>>("@/lib/mcp-client");
    return {
        ...actual,
        useLegalPokemon: () => legalPokemonStub,
    };
});

// Reset the stub between tests so earlier tests don't leak grouping state.
beforeEach(() => {
    legalPokemonStub.data = undefined;
    legalPokemonStub.isLoading = false;
});

function renderWithClient(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("PokemonCombobox", () => {
    it("renders the current value in the trigger input", () => {
        renderWithClient(<PokemonCombobox value="Pikachu" onChange={() => {}} format="gen9ou" />);
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

    it("shows an ungrouped list while legality is loading", () => {
        legalPokemonStub.data = undefined;
        legalPokemonStub.isLoading = true;
        renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
        fireEvent.focus(screen.getByRole("combobox"));
        expect(screen.queryByText(/Legal in/i)).not.toBeInTheDocument();
        expect(screen.getByText(/All Pokémon/i)).toBeInTheDocument();
    });

    it("groups results into 'Legal in {format}' and 'Other' when legality is available", () => {
        legalPokemonStub.data = new Set(["pikachu"]);
        legalPokemonStub.isLoading = false;
        renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
        fireEvent.focus(screen.getByRole("combobox"));
        expect(screen.getByText(/Legal in gen9ou/i)).toBeInTheDocument();
        expect(screen.getByText("Other")).toBeInTheDocument();
    });

    it("skips the 'Other' group when all filtered results are legal", () => {
        // Use "landorustherian" — exactly one display name matches "landorus-therian"
        // (the base "Landorus" form does not match the substring "landorus-therian").
        // This ensures the Other group has zero matching items and cmdk hides it.
        legalPokemonStub.data = new Set(["landorustherian"]);
        legalPokemonStub.isLoading = false;
        renderWithClient(<PokemonCombobox value="" onChange={() => {}} format="gen9ou" />);
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "landorus-therian" } });
        // When all items in the "Other" group are filtered out, the group heading
        // should not be visible (cmdk hides it via the hidden attribute or display:none).
        const otherHeading = screen.queryByText("Other");
        expect(otherHeading).not.toBeVisible();
    });
});
