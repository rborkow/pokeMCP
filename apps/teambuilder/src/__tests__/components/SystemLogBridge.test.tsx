import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SystemLogBridge } from "@/components/providers/SystemLogBridge";
import { useChatStore } from "@/stores/chat-store";
import { useTeamStore } from "@/stores/team-store";
import { render } from "../test-utils";

const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

describe("SystemLogBridge", () => {
    beforeEach(() => {
        useTeamStore.getState().clearTeam();
        useChatStore.getState().clearSystemLog();
        vi.clearAllMocks();
    });

    it("appends a system log entry when the user adds a Pokémon manually", () => {
        render(<SystemLogBridge />);
        act(() => {
            useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] }, "user");
        });
        const log = useChatStore.getState().systemLog;
        expect(log).toHaveLength(1);
        expect(log[0].text.toLowerCase()).toContain("added");
        expect(log[0].slot).toBe(0);
        expect(log[0].kind).toBe("user_edit");
    });

    it("does NOT log when the source is AI", () => {
        render(<SystemLogBridge />);
        act(() => {
            useTeamStore.getState().setPokemon(0, { pokemon: "Scizor", moves: [] }, "ai");
        });
        expect(useChatStore.getState().systemLog).toHaveLength(0);
    });

    it("does NOT log on imports", () => {
        render(<SystemLogBridge />);
        act(() => {
            useTeamStore
                .getState()
                .importTeam("Garchomp @ Life Orb\nAbility: Rough Skin\n- Earthquake");
        });
        expect(useChatStore.getState().systemLog).toHaveLength(0);
    });

    it("describes specific field changes for item edits", async () => {
        render(<SystemLogBridge />);
        act(() => {
            useTeamStore
                .getState()
                .setPokemon(
                    0,
                    { pokemon: "Kingambit", moves: ["Kowtow Cleave"], item: "Leftovers" },
                    "user",
                );
        });
        await waitFor(() => {
            expect(useChatStore.getState().systemLog.length).toBeGreaterThan(0);
        });
        useChatStore.getState().clearSystemLog();
        act(() => {
            useTeamStore.getState().setPokemon(
                0,
                {
                    pokemon: "Kingambit",
                    moves: ["Kowtow Cleave"],
                    item: "Black Glasses",
                },
                "user",
            );
        });
        await waitFor(() => {
            const log = useChatStore.getState().systemLog;
            expect(log.some((e) => /item to Black Glasses/i.test(e.text))).toBe(true);
        });
    });
});
