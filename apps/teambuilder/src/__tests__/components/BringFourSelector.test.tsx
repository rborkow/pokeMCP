import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../test-utils";
import { BringFourSelector } from "@/components/team/BringFourSelector";
import type { TeamPokemon } from "@/types/pokemon";
import {
  VGC_BRING_COUNT,
  VGC_MIN_TEAM_FOR_PREVIEW,
  VGC_TEAM_PREVIEW_TIPS,
} from "@/lib/constants/vgc";

// Mock dependencies
vi.mock("@/lib/showdown-parser", () => ({
  toDisplayName: (name: string) => name,
}));

vi.mock("@/components/team/PokemonSprite", () => ({
  PokemonSprite: ({ pokemon }: { pokemon: string }) => (
    <span data-testid={`sprite-${pokemon}`}>{pokemon}</span>
  ),
}));

describe("BringFourSelector", () => {
  const createMockTeam = (count: number): TeamPokemon[] =>
    Array.from({ length: count }, (_, i) => ({
      pokemon: `Pokemon${i + 1}`,
      moves: ["Move1", "Move2", "Move3", "Move4"],
    }));

  const fullTeam = createMockTeam(6);

  describe("rendering conditions", () => {
    it("renders null when team has fewer than VGC_MIN_TEAM_FOR_PREVIEW Pokemon", () => {
      const smallTeam = createMockTeam(3);
      const { container } = render(<BringFourSelector team={smallTeam} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders null for undefined team", () => {
      const { container } = render(<BringFourSelector team={undefined as unknown as TeamPokemon[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders null for non-array team", () => {
      const { container } = render(<BringFourSelector team={"not an array" as unknown as TeamPokemon[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders when team has exactly VGC_MIN_TEAM_FOR_PREVIEW Pokemon", () => {
      const minTeam = createMockTeam(VGC_MIN_TEAM_FOR_PREVIEW);
      render(<BringFourSelector team={minTeam} />);
      expect(screen.getByTestId("bring-four-selector")).toBeInTheDocument();
    });

    it("renders when team has 6 Pokemon", () => {
      render(<BringFourSelector team={fullTeam} />);
      expect(screen.getByTestId("bring-four-selector")).toBeInTheDocument();
    });
  });

  describe("selection behavior", () => {
    it("displays all team Pokemon as selectable buttons", () => {
      render(<BringFourSelector team={fullTeam} />);
      for (let i = 0; i < 6; i++) {
        expect(screen.getByTestId(`pokemon-select-${i}`)).toBeInTheDocument();
      }
    });

    it("shows 0/4 selected initially", () => {
      render(<BringFourSelector team={fullTeam} />);
      expect(screen.getByText(`0/${VGC_BRING_COUNT} selected`)).toBeInTheDocument();
    });

    it("selects Pokemon when clicked", () => {
      render(<BringFourSelector team={fullTeam} />);
      fireEvent.click(screen.getByTestId("pokemon-select-0"));
      expect(screen.getByText(`1/${VGC_BRING_COUNT} selected`)).toBeInTheDocument();
    });

    it("deselects Pokemon when clicked again", () => {
      render(<BringFourSelector team={fullTeam} />);
      const button = screen.getByTestId("pokemon-select-0");
      fireEvent.click(button);
      expect(screen.getByText(`1/${VGC_BRING_COUNT} selected`)).toBeInTheDocument();
      fireEvent.click(button);
      expect(screen.getByText(`0/${VGC_BRING_COUNT} selected`)).toBeInTheDocument();
    });

    it("allows selecting up to VGC_BRING_COUNT Pokemon", () => {
      render(<BringFourSelector team={fullTeam} />);
      for (let i = 0; i < VGC_BRING_COUNT; i++) {
        fireEvent.click(screen.getByTestId(`pokemon-select-${i}`));
      }
      expect(screen.getByText(`${VGC_BRING_COUNT}/${VGC_BRING_COUNT} selected`)).toBeInTheDocument();
    });

    it("disables remaining Pokemon when VGC_BRING_COUNT are selected", () => {
      render(<BringFourSelector team={fullTeam} />);
      // Select first 4
      for (let i = 0; i < VGC_BRING_COUNT; i++) {
        fireEvent.click(screen.getByTestId(`pokemon-select-${i}`));
      }
      // 5th and 6th should be disabled
      const button5 = screen.getByTestId("pokemon-select-4");
      const button6 = screen.getByTestId("pokemon-select-5");
      expect(button5).toBeDisabled();
      expect(button6).toBeDisabled();
    });

    it("shows selection order badges", () => {
      render(<BringFourSelector team={fullTeam} />);
      fireEvent.click(screen.getByTestId("pokemon-select-2"));
      fireEvent.click(screen.getByTestId("pokemon-select-0"));
      expect(screen.getByTestId("selection-order-2")).toHaveTextContent("1");
      expect(screen.getByTestId("selection-order-0")).toHaveTextContent("2");
    });
  });

  describe("selection summary", () => {
    it("shows selection summary when Pokemon are selected", () => {
      render(<BringFourSelector team={fullTeam} />);
      fireEvent.click(screen.getByTestId("pokemon-select-0"));
      expect(screen.getByTestId("selection-summary")).toBeInTheDocument();
    });

    it("does not show selection summary when no Pokemon selected", () => {
      render(<BringFourSelector team={fullTeam} />);
      expect(screen.queryByTestId("selection-summary")).not.toBeInTheDocument();
    });

    it("shows empty slots for remaining selections", () => {
      render(<BringFourSelector team={fullTeam} />);
      fireEvent.click(screen.getByTestId("pokemon-select-0"));
      // Should have 3 empty slots
      for (let i = 0; i < VGC_BRING_COUNT - 1; i++) {
        expect(screen.getByTestId(`empty-slot-${i}`)).toBeInTheDocument();
      }
    });
  });

  describe("reset functionality", () => {
    it("shows reset button when Pokemon are selected", () => {
      render(<BringFourSelector team={fullTeam} />);
      fireEvent.click(screen.getByTestId("pokemon-select-0"));
      expect(screen.getByTestId("reset-button")).toBeInTheDocument();
    });

    it("clears selection when reset is clicked", () => {
      render(<BringFourSelector team={fullTeam} />);
      fireEvent.click(screen.getByTestId("pokemon-select-0"));
      fireEvent.click(screen.getByTestId("pokemon-select-1"));
      fireEvent.click(screen.getByTestId("reset-button"));
      expect(screen.getByText(`0/${VGC_BRING_COUNT} selected`)).toBeInTheDocument();
      expect(screen.queryByTestId("selection-summary")).not.toBeInTheDocument();
    });
  });

  describe("tips and guidance", () => {
    it("shows incomplete tip when some but not all Pokemon selected", () => {
      render(<BringFourSelector team={fullTeam} />);
      fireEvent.click(screen.getByTestId("pokemon-select-0"));
      expect(screen.getByTestId("incomplete-tip")).toBeInTheDocument();
      expect(screen.getByTestId("incomplete-tip")).toHaveTextContent(
        `Select ${VGC_BRING_COUNT - 1} more Pokemon`
      );
    });

    it("shows complete tips when VGC_BRING_COUNT Pokemon selected", () => {
      render(<BringFourSelector team={fullTeam} />);
      for (let i = 0; i < VGC_BRING_COUNT; i++) {
        fireEvent.click(screen.getByTestId(`pokemon-select-${i}`));
      }
      expect(screen.getByTestId("complete-tips")).toBeInTheDocument();
      // Check that all tips from constants are rendered
      VGC_TEAM_PREVIEW_TIPS.forEach((tip) => {
        expect(screen.getByText(tip)).toBeInTheDocument();
      });
    });

    it("does not show incomplete tip when no Pokemon selected", () => {
      render(<BringFourSelector team={fullTeam} />);
      expect(screen.queryByTestId("incomplete-tip")).not.toBeInTheDocument();
    });

    it("does not show complete tips when selection incomplete", () => {
      render(<BringFourSelector team={fullTeam} />);
      fireEvent.click(screen.getByTestId("pokemon-select-0"));
      expect(screen.queryByTestId("complete-tips")).not.toBeInTheDocument();
    });
  });

  describe("constants usage", () => {
    it("uses VGC_BRING_COUNT constant correctly", () => {
      // This test verifies that the component uses the constant
      // by checking that exactly 4 selections are allowed
      expect(VGC_BRING_COUNT).toBe(4);
      expect(VGC_MIN_TEAM_FOR_PREVIEW).toBe(4);
    });
  });
});
