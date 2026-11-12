import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import { render, screen } from "./test-utils";

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
                team: ["Charizard", "Venusaur", "Farigiraf", "Scrafty", "Sylveon", "Garchomp"].map(
                    (name) => ({
                        id: name.toLowerCase(),
                        name,
                        item: null,
                        ability: null,
                        moves: [],
                        nature: null,
                    }),
                ),
            },
        ],
        topCutUsage: [],
        usageComparison: [
            { id: "charizard", name: "Charizard", count: 1, pct: 50, ladderUsage: 0.2 },
        ],
    })),
}));

describe("Home page", () => {
    beforeEach(() => vi.clearAllMocks());

    it("leads with the connector and how to add it", async () => {
        render(await HomePage());

        expect(
            screen.getByRole("heading", {
                name: /Build Champions teams with the assistant you already use/i,
            }),
        ).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Add VGC Teambuilder/i })).toHaveAttribute(
            "href",
            "https://docs.pokemcp.com/getting-started",
        );
        expect(screen.getByText("https://api.pokemcp.com/mcp")).toBeInTheDocument();
    });

    it("shows tournament results without any link into the retired Prep", async () => {
        const { container } = render(await HomePage());

        expect(screen.getByText("Sitrus Series")).toBeInTheDocument();
        expect(screen.getByText("TytokiArts")).toBeInTheDocument();
        const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
        for (const retired of ["/prep", "/teams", "/account", "/build"]) {
            expect(hrefs.some((href) => href?.startsWith(retired))).toBe(false);
        }
    });

    it("labels sourced and calculated information", async () => {
        render(await HomePage());
        expect(screen.getAllByText(/Tournament source/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/Top-cut vs ladder difference/i)).toBeInTheDocument();
    });

    it("says it is an unofficial fan project", async () => {
        render(await HomePage());
        expect(screen.getByText(/unofficial fan project/i)).toBeInTheDocument();
    });
});
