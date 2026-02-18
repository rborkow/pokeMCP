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

    it("POSTs to /api/team/share with team and format", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ id: "abc123", url: "https://www.pokemcp.com/t/abc123" }),
        });

        await createSharedTeam(sampleTeam, "gen9ou");

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/team/share"),
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ team: sampleTeam, format: "gen9ou" }),
            }),
        );
    });

    it("returns { id, url } on success", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ id: "abc123", url: "https://www.pokemcp.com/t/abc123" }),
        });

        const result = await createSharedTeam(sampleTeam, "gen9ou");
        expect(result).toEqual({ id: "abc123", url: "https://www.pokemcp.com/t/abc123" });
    });

    it("throws server error message when response has error field", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: () => Promise.resolve({ error: "Rate limited" }),
        });

        await expect(createSharedTeam(sampleTeam, "gen9ou")).rejects.toThrow("Rate limited");
    });

    it("throws generic error when response body is not JSON", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.reject(new Error("not json")),
        });

        await expect(createSharedTeam(sampleTeam, "gen9ou")).rejects.toThrow("Request failed");
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
