import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoizedMarkdown } from "@/components/chat/MemoizedMarkdown";

describe("MemoizedMarkdown", () => {
    it("renders markdown content with GFM support", () => {
        render(<MemoizedMarkdown content="# Hello\n\nThis is **bold** and ~~struck~~." />);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hello");
        expect(screen.getByText("bold")).toBeInTheDocument();
    });

    it("renders empty string without errors", () => {
        const { container } = render(<MemoizedMarkdown content="" />);
        expect(container.firstChild).toBeEmptyDOMElement();
    });

    it("renders multiple blocks independently", () => {
        render(<MemoizedMarkdown content={"# Title\n\nParagraph one.\n\n- Item 1\n- Item 2"} />);
        expect(screen.getByRole("heading")).toHaveTextContent("Title");
        expect(screen.getByText("Paragraph one.")).toBeInTheDocument();
        expect(screen.getByText("Item 1")).toBeInTheDocument();
    });
});
