import { beforeEach, describe, expect, it, vi } from "vitest";
import NewsroomPage from "@/app/page";
import { render, screen } from "./test-utils";

vi.mock("@/lib/prep/analytics", () => ({ trackPrepEvent: vi.fn() }));
vi.mock("@/lib/live-events", () => ({
    getNewsroomEvents: vi.fn(async () => ({
        fetchedAt: "2026-07-03T05:29:15.578Z",
        stale: false,
        events: [
            {
                slug: "sample-event",
                name: "Sitrus Series",
                date: "2026-07-01T22:00:00.000Z",
                players: 114,
                format: "M-B",
                regulationLabel: "Pokémon Champions — Regulation M-B",
            },
        ],
    })),
    getEventForRequest: vi.fn(async () => ({
        id: "event-1",
        slug: "sample-event",
        name: "Sitrus Series",
        date: "2026-07-01T22:00:00.000Z",
        players: 114,
        format: "M-B",
        regulationId: "champions-regmb",
        regulationLabel: "Pokémon Champions — Regulation M-B",
        source: "limitless",
        sourceUrl: "https://play.limitlesstcg.com/tournament/event-1",
        attribution: "Data via Limitless",
        fetchedAt: "2026-07-03T05:29:15.578Z",
        topCut: [
            {
                placing: 1,
                player: "TytokiArts",
                country: null,
                record: { wins: 11, losses: 1, ties: 0 },
                team: ["Charizard", "Venusaur", "Farigiraf", "Scrafty", "Sylveon", "Garchomp"].map((name) => ({ id: name.toLowerCase(), name, item: null, ability: null, moves: [], nature: null })),
            },
        ],
        topCutUsage: [],
        usageComparison: [
            { id: "charizard", name: "Charizard", count: 1, pct: 50, ladderUsage: 0.2 },
        ],
    })),
}));

describe("Tournament newsroom", () => {
    beforeEach(() => vi.clearAllMocks());

    it("leads with tournament preparation and a direct prep action", async () => {
        render(await NewsroomPage());

        expect(
            screen.getByRole("heading", {
                name: /Prepare for the teams people are actually bringing/i,
            }),
        ).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Start a matchup plan/i })).toHaveAttribute(
            "href",
            "/prep/new",
        );
        expect(screen.getByText("Sitrus Series")).toBeInTheDocument();
        expect(screen.getByText("TytokiArts")).toBeInTheDocument();
    });

    it("labels sourced and calculated newsroom information", async () => {
        render(await NewsroomPage());
        expect(screen.getAllByText(/Tournament source/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/Top-cut vs ladder difference/i)).toBeInTheDocument();
    });
});
