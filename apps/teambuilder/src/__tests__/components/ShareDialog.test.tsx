import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../test-utils";
import userEvent from "@testing-library/user-event";
import { ShareDialog } from "@/components/team/ShareDialog";
import type { TeamPokemon } from "@/types/pokemon";

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

// Mock share.ts
const mockCopyToClipboard = vi.fn((_text: unknown) => {
    void _text;
    return Promise.resolve(true);
});
vi.mock("@/lib/share", () => ({
    generateShareUrl: vi.fn(() => "https://www.pokemcp.com?team=encoded123"),
    copyToClipboard: (text: unknown) => mockCopyToClipboard(text),
}));

// Mock social-share
vi.mock("@/lib/social-share", () => ({
    getTwitterShareUrl: vi.fn(() => "https://twitter.com/intent/tweet?text=test"),
    getRedditShareUrl: vi.fn(() => "https://reddit.com/submit?title=test"),
    formatDiscordMessage: vi.fn(() => "**Gen 9 OU Team**\n..."),
    downloadTeamAsJson: vi.fn(),
}));

// Mock showdown-parser
vi.mock("@/lib/showdown-parser", () => ({
    exportShowdownTeam: vi.fn(() => "Garchomp @ Life Orb\n- Earthquake"),
}));

// Mock QRCodeSVG
vi.mock("qrcode.react", () => ({
    QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-code" data-value={value} />,
}));

// Mock TeamCard
vi.mock("@/components/team/TeamCard", () => ({
    TeamCard: vi.fn(() => <div data-testid="team-card" />),
}));

const sampleTeam: TeamPokemon[] = [
    { pokemon: "Garchomp", moves: ["Earthquake"], item: "Life Orb", ability: "Rough Skin" },
    { pokemon: "Landorus-Therian", moves: ["U-turn"], item: "Choice Scarf", ability: "Intimidate" },
];

describe("ShareDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initial render", () => {
        it("renders a portable link without creating a stored record", () => {
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            expect(screen.getByText("Share Team")).toBeInTheDocument();
            expect(
                screen.getByDisplayValue("https://www.pokemcp.com?team=encoded123"),
            ).toBeInTheDocument();
            expect(
                screen.getByText(/new stored links are no longer created/i),
            ).toBeInTheDocument();
        });

        it("does not render a QR code for an empty team", () => {
            render(<ShareDialog open={true} onOpenChange={vi.fn()} team={[]} format="gen9ou" />);
            expect(screen.queryByTestId("qr-code")).not.toBeInTheDocument();
        });
    });

    describe("Link tab", () => {
        it("shows the portable URL and QR code", () => {
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            expect(
                screen.getByDisplayValue("https://www.pokemcp.com?team=encoded123"),
            ).toBeInTheDocument();
            expect(screen.getByTestId("qr-code")).toBeInTheDocument();
        });

        it("copy button calls copyToClipboard with the URL", async () => {
            const user = userEvent.setup();
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            const copyButtons = screen.getAllByRole("button");
            const copyButton = copyButtons.find((btn) => btn.textContent?.includes("Copy"));
            expect(copyButton).toBeDefined();
            await user.click(copyButton!);
            expect(mockCopyToClipboard).toHaveBeenCalledWith(
                "https://www.pokemcp.com?team=encoded123",
            );
        });
    });

    describe("Social tab", () => {
        it("renders Twitter/X, Reddit, and Discord share options", async () => {
            const user = userEvent.setup();
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            await user.click(screen.getByRole("tab", { name: /social/i }));
            await waitFor(() => {
                expect(screen.getByText("Share on X / Twitter")).toBeInTheDocument();
            });
            expect(screen.getByText("Share on Reddit")).toBeInTheDocument();
            expect(screen.getByText("Copy for Discord")).toBeInTheDocument();
        });

        it("copies Discord message on click", async () => {
            const user = userEvent.setup();
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            await user.click(screen.getByRole("tab", { name: /social/i }));
            await waitFor(() => {
                expect(screen.getByText("Copy for Discord")).toBeInTheDocument();
            });
            await user.click(screen.getByText("Copy for Discord"));
            expect(mockCopyToClipboard).toHaveBeenCalledWith("**Gen 9 OU Team**\n...");
        });
    });

    describe("Export tab", () => {
        it("shows Showdown paste and download buttons", async () => {
            const user = userEvent.setup();
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            await user.click(screen.getByRole("tab", { name: /export/i }));
            await waitFor(() => {
                expect(screen.getByText("Showdown Paste")).toBeInTheDocument();
            });
            expect(screen.getByText("Download JSON")).toBeInTheDocument();
            expect(screen.getByText("Download Image")).toBeInTheDocument();
        });

        it("shows showdown text in the textarea", async () => {
            const user = userEvent.setup();
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            await user.click(screen.getByRole("tab", { name: /export/i }));
            await waitFor(() => {
                expect(screen.getByText("Showdown Paste")).toBeInTheDocument();
            });
            const textarea = screen.getByRole("textbox");
            expect(textarea).toHaveValue("Garchomp @ Life Orb\n- Earthquake");
        });
    });
});
