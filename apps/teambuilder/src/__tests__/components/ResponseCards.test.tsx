import { describe, expect, it } from "vitest";
import { DataCard } from "@/components/chat/response/DataCard";
import { ResponseDispatcher } from "@/components/chat/response/ResponseDispatcher";
import { TeamDiffCard } from "@/components/chat/response/TeamDiffCard";
import { render, screen } from "../test-utils";

describe("response cards", () => {
    it("DataCard renders title + labeled rows", () => {
        render(
            <DataCard
                data={{
                    kind: "data",
                    title: "Speed benchmark",
                    rows: [
                        { label: "Base", value: "116" },
                        { label: "+Scarf", value: "415", tone: "good" },
                    ],
                }}
            />,
        );
        expect(screen.getByText("Speed benchmark")).toBeInTheDocument();
        expect(screen.getByText("Base")).toBeInTheDocument();
        expect(screen.getByText("415")).toBeInTheDocument();
    });

    it("TeamDiffCard renders slot changes and summary", () => {
        render(
            <TeamDiffCard
                data={{
                    kind: "team_diff",
                    summary: "Swapped Rillaboom for Scizor.",
                    changes: [
                        {
                            slot: 3,
                            from: "Rillaboom",
                            to: "Scizor",
                            note: "Bullet Punch",
                        },
                    ],
                }}
            />,
        );
        expect(screen.getByText(/Swapped Rillaboom for Scizor/i)).toBeInTheDocument();
        expect(screen.getByText("Rillaboom")).toBeInTheDocument();
        expect(screen.getByText("Scizor")).toBeInTheDocument();
        expect(screen.getByText(/slot 4/i)).toBeInTheDocument();
    });

    it("ResponseDispatcher renders the right component for each kind", () => {
        const { rerender } = render(
            <ResponseDispatcher
                card={{
                    kind: "analysis_highlight",
                    focus: "Speed control",
                    detail: "Iron Valiant is your only answer.",
                }}
            />,
        );
        expect(screen.getByText("Speed control")).toBeInTheDocument();

        rerender(
            <ResponseDispatcher
                card={{
                    kind: "matchup",
                    opponent: "Scarf Garchomp",
                    winRateEstimate: "31%",
                }}
            />,
        );
        expect(screen.getByText(/Matchup · Scarf Garchomp/i)).toBeInTheDocument();
        expect(screen.getByText("31%")).toBeInTheDocument();
    });

    it("ResponseDispatcher returns null on invalid input", () => {
        const { container } = render(<ResponseDispatcher card={{ kind: "??" }} />);
        expect(container.firstChild).toBeNull();
    });
});
