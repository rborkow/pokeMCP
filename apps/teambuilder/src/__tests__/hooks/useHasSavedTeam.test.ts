import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHasSavedTeam } from "@/hooks/useHasSavedTeam";
import { useTeamStore } from "@/stores/team-store";

const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

describe("useHasSavedTeam", () => {
    beforeEach(() => {
        useTeamStore.getState().clearTeam();
        vi.clearAllMocks();
    });

    it("returns hasSavedTeam=false when the persisted team is empty", async () => {
        const { result } = renderHook(() => useHasSavedTeam());
        await waitFor(() => expect(result.current.hydrated).toBe(true));
        expect(result.current.hasSavedTeam).toBe(false);
    });

    it("returns hasSavedTeam=true once a team exists after hydration", async () => {
        const { result } = renderHook(() => useHasSavedTeam());
        await waitFor(() => expect(result.current.hydrated).toBe(true));

        act(() => {
            useTeamStore.getState().setPokemon(0, {
                pokemon: "Garchomp",
                moves: ["Earthquake"],
            });
        });

        expect(result.current.hasSavedTeam).toBe(true);
    });

    it("flips back to false after the team is cleared", async () => {
        const { result } = renderHook(() => useHasSavedTeam());
        await waitFor(() => expect(result.current.hydrated).toBe(true));

        act(() => {
            useTeamStore.getState().setPokemon(0, {
                pokemon: "Garchomp",
                moves: ["Earthquake"],
            });
        });
        expect(result.current.hasSavedTeam).toBe(true);

        act(() => {
            useTeamStore.getState().clearTeam();
        });
        expect(result.current.hasSavedTeam).toBe(false);
    });
});
