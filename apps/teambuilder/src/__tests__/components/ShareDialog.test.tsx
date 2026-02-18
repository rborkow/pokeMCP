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

// Mock share-api
const mockCreateSharedTeam = vi.fn();
vi.mock("@/lib/share-api", () => ({
    createSharedTeam: (...args: unknown[]) => mockCreateSharedTeam(args[0], args[1]),
}));

// Mock share.ts
const mockCopyToClipboard = vi.fn((_text: unknown) => Promise.resolve(true));
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
        mockCreateSharedTeam.mockResolvedValue({
            id: "abc123",
            url: "https://www.pokemcp.com/t/abc123",
        });
    });

    describe("initial render and API call", () => {
        it("renders dialog with title when open", async () => {
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            expect(screen.getByText("Share Team")).toBeInTheDocument();
            await waitFor(() => {
                expect(mockCreateSharedTeam).toHaveBeenCalled();
            });
        });

        it("calls createSharedTeam when opened with a non-empty team", async () => {
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            await waitFor(() => {
                expect(mockCreateSharedTeam).toHaveBeenCalledWith(sampleTeam, "gen9ou");
            });
        });

        it("shows short URL after API resolves", async () => {
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            await waitFor(() => {
                expect(
                    screen.getByDisplayValue("https://www.pokemcp.com/t/abc123"),
                ).toBeInTheDocument();
            });
        });

        it("falls back to direct URL and shows error on API failure", async () => {
            mockCreateSharedTeam.mockRejectedValue(new Error("Network error"));
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            await waitFor(() => {
                expect(screen.getByText(/Failed to create short link/)).toBeInTheDocument();
            });
            expect(
                screen.getByDisplayValue("https://www.pokemcp.com?team=encoded123"),
            ).toBeInTheDocument();
        });

        it("does not call API when team is empty", () => {
            render(<ShareDialog open={true} onOpenChange={vi.fn()} team={[]} format="gen9ou" />);
            expect(mockCreateSharedTeam).not.toHaveBeenCalled();
        });
    });

    describe("Link tab", () => {
        it("is the default active tab with URL input visible", async () => {
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            await waitFor(() => {
                expect(
                    screen.getByDisplayValue("https://www.pokemcp.com/t/abc123"),
                ).toBeInTheDocument();
            });
        });

        it("shows QR code after loading completes", async () => {
            render(
                <ShareDialog
                    open={true}
                    onOpenChange={vi.fn()}
                    team={sampleTeam}
                    format="gen9ou"
                />,
            );
            await waitFor(() => {
                expect(screen.getByTestId("qr-code")).toBeInTheDocument();
            });
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
            await waitFor(() => {
                expect(
                    screen.getByDisplayValue("https://www.pokemcp.com/t/abc123"),
                ).toBeInTheDocument();
            });
            const copyButtons = screen.getAllByRole("button");
            const copyButton = copyButtons.find((btn) => btn.textContent?.includes("Copy"));
            expect(copyButton).toBeDefined();
            await user.click(copyButton!);
            expect(mockCopyToClipboard).toHaveBeenCalledWith("https://www.pokemcp.com/t/abc123");
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
            await waitFor(() => {
                expect(mockCreateSharedTeam).toHaveBeenCalled();
            });
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
            await waitFor(() => {
                expect(mockCreateSharedTeam).toHaveBeenCalled();
            });
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
            await waitFor(() => {
                expect(mockCreateSharedTeam).toHaveBeenCalled();
            });
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
            await waitFor(() => {
                expect(mockCreateSharedTeam).toHaveBeenCalled();
            });
            await user.click(screen.getByRole("tab", { name: /export/i }));
            await waitFor(() => {
                expect(screen.getByText("Showdown Paste")).toBeInTheDocument();
            });
            const textarea = screen.getByRole("textbox");
            expect(textarea).toHaveValue("Garchomp @ Life Orb\n- Earthquake");
        });
    });
});
