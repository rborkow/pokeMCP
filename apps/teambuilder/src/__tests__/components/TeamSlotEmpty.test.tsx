import { describe, expect, it, vi } from "vitest";
import { TeamSlotEmpty } from "@/components/team/TeamSlotEmpty";
import { fireEvent, render, screen } from "../test-utils";

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
        render(<TeamSlotEmpty {...defaultProps} onClick={onClick} />);
        fireEvent.click(screen.getByRole("button"));
        expect(onClick).toHaveBeenCalledTimes(1);
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
