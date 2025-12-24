import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../test-utils";
import { TeamSlotEmpty } from "@/components/team/TeamSlotEmpty";

describe("TeamSlotEmpty", () => {
    const defaultProps = {
        slot: 0,
        onClick: vi.fn(),
    };

    it("renders Add Pokemon text", () => {
        render(<TeamSlotEmpty {...defaultProps} />);
        expect(screen.getByText("Add Pokemon")).toBeInTheDocument();
    });

    it("renders Click to browse helper text", () => {
        render(<TeamSlotEmpty {...defaultProps} />);
        expect(screen.getByText("Click to browse")).toBeInTheDocument();
    });

    it("renders a plus icon", () => {
        const { container } = render(<TeamSlotEmpty {...defaultProps} />);
        // Lucide Plus icon renders as an SVG
        const svg = container.querySelector("svg");
        expect(svg).toBeInTheDocument();
    });

    it("calls onClick when clicked", () => {
        const onClick = vi.fn();
        const { container } = render(<TeamSlotEmpty {...defaultProps} onClick={onClick} />);

        // Find the pokemon-card-empty button element
        const card = container.querySelector(".pokemon-card-empty");
        fireEvent.click(card!);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("has pokemon-card-empty class for styling", () => {
        const { container } = render(<TeamSlotEmpty {...defaultProps} />);
        const card = container.querySelector(".pokemon-card-empty");
        expect(card).toBeInTheDocument();
    });

    it("has glow-effect class for hover styling", () => {
        const { container } = render(<TeamSlotEmpty {...defaultProps} />);
        const card = container.querySelector(".glow-effect");
        expect(card).toBeInTheDocument();
    });

    it("renders without onClick prop", () => {
        const { onClick, ...propsWithoutClick } = defaultProps;
        render(<TeamSlotEmpty {...propsWithoutClick} />);
        expect(screen.getByText("Add Pokemon")).toBeInTheDocument();
    });

    it("renders correctly for different slot numbers", () => {
        render(<TeamSlotEmpty slot={5} onClick={vi.fn()} />);
        expect(screen.getByText("Add Pokemon")).toBeInTheDocument();
    });

    it("is rendered as a button element for accessibility", () => {
        render(<TeamSlotEmpty {...defaultProps} />);
        const button = screen.getByRole("button");
        expect(button).toBeInTheDocument();
    });
});
