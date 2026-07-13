import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSharedTeam, fetchSharedTeam } from "@/lib/share-api";
import type { TeamPokemon } from "@/types/pokemon";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const sampleTeam: TeamPokemon[] = [
    { pokemon: "Garchomp", moves: ["Earthquake"], item: "Life Orb", ability: "Rough Skin" },
];

describe("createSharedTeam", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("refuses to create a new persistent record without making a request", async () => {
        await expect(createSharedTeam(sampleTeam, "gen9ou")).rejects.toThrow(
            "New persistent team links are retired",
        );
        expect(mockFetch).not.toHaveBeenCalled();
    });
});

describe("fetchSharedTeam", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("GETs /api/team/:id", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    id: "abc123",
                    team: sampleTeam,
                    format: "gen9ou",
                    createdAt: "2026-01-01T00:00:00Z",
                }),
        });

        await fetchSharedTeam("abc123");

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/team/abc123"),
            expect.anything(),
        );
    });

    it("returns SharedTeam data on success", async () => {
        const teamData = {
            id: "abc123",
            team: sampleTeam,
            format: "gen9ou",
            createdAt: "2026-01-01T00:00:00Z",
        };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(teamData),
        });

        const result = await fetchSharedTeam("abc123");
        expect(result).toEqual(teamData);
    });

    it("returns null for 404 responses", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

        const result = await fetchSharedTeam("nonexistent");
        expect(result).toBeNull();
    });

    it("throws for non-404 error responses", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

        await expect(fetchSharedTeam("abc123")).rejects.toThrow("Failed to fetch team: 500");
    });
});
