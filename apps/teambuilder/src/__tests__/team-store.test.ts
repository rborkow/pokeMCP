import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTeamStore } from "@/stores/team-store";
import type { TeamPokemon } from "@/types/pokemon";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal("localStorage", localStorageMock);

describe("team-store", () => {
  beforeEach(() => {
    // Reset store between tests
    useTeamStore.getState().clearTeam();
    useTeamStore.getState().setFormat("gen9ou");
    vi.clearAllMocks();
  });

  describe("setPokemon", () => {
    it("should add a Pokemon to a slot", () => {
      const pokemon: TeamPokemon = { pokemon: "Garchomp", moves: ["Earthquake"] };
      useTeamStore.getState().setPokemon(0, pokemon);

      const team = useTeamStore.getState().team;
      expect(team[0]).toEqual(pokemon);
    });

    it("should allow adding Pokemon to any slot", () => {
      const pokemon: TeamPokemon = { pokemon: "Garchomp", moves: [] };
      useTeamStore.getState().setPokemon(2, pokemon);

      // selectedSlot is not automatically set by setPokemon
      expect(useTeamStore.getState().team[0].pokemon).toBe("Garchomp");
    });

    it("should allow building a team of 6 Pokemon", () => {
      for (let i = 0; i < 6; i++) {
        useTeamStore.getState().setPokemon(i, { pokemon: `Pokemon${i}`, moves: [] });
      }

      const team = useTeamStore.getState().team;
      expect(team).toHaveLength(6);
    });
  });

  describe("removePokemon", () => {
    it("should remove a Pokemon from a slot", () => {
      useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });
      useTeamStore.getState().removePokemon(0);

      const team = useTeamStore.getState().team;
      expect(team).toHaveLength(0);
    });

    it("should shift remaining Pokemon down", () => {
      useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });
      useTeamStore.getState().setPokemon(1, { pokemon: "Landorus-Therian", moves: [] });
      useTeamStore.getState().setPokemon(2, { pokemon: "Kingambit", moves: [] });

      useTeamStore.getState().removePokemon(1);

      const team = useTeamStore.getState().team;
      expect(team).toHaveLength(2);
      expect(team[0].pokemon).toBe("Garchomp");
      expect(team[1].pokemon).toBe("Kingambit");
    });
  });

  describe("clearTeam", () => {
    it("should remove all Pokemon", () => {
      useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });
      useTeamStore.getState().setPokemon(1, { pokemon: "Landorus-Therian", moves: [] });

      useTeamStore.getState().clearTeam();

      expect(useTeamStore.getState().team).toHaveLength(0);
    });

    it("should reset selectedSlot to null", () => {
      useTeamStore.getState().setPokemon(0, { pokemon: "Garchomp", moves: [] });
      useTeamStore.getState().clearTeam();

      expect(useTeamStore.getState().selectedSlot).toBeNull();
    });
  });

  describe("setFormat", () => {
    it("should update the format", () => {
      useTeamStore.getState().setFormat("gen9ubers");

      expect(useTeamStore.getState().format).toBe("gen9ubers");
    });
  });

  describe("setSelectedSlot", () => {
    it("should update the selected slot", () => {
      useTeamStore.getState().setSelectedSlot(3);

      expect(useTeamStore.getState().selectedSlot).toBe(3);
    });

    it("should accept null", () => {
      useTeamStore.getState().setSelectedSlot(3);
      useTeamStore.getState().setSelectedSlot(null);

      expect(useTeamStore.getState().selectedSlot).toBeNull();
    });
  });

  describe("importTeam", () => {
    it("should parse and set team from Showdown format", () => {
      const paste = `Garchomp @ Life Orb
Ability: Rough Skin
- Earthquake

Landorus-Therian @ Choice Scarf
Ability: Intimidate
- U-turn`;

      useTeamStore.getState().importTeam(paste);

      const team = useTeamStore.getState().team;
      expect(team).toHaveLength(2);
      expect(team[0].pokemon).toBe("Garchomp");
      expect(team[1].pokemon).toBe("Landorus-Therian");
    });

    it("should reject team with more than 6 Pokemon", () => {
      const paste = Array(8)
        .fill(null)
        .map((_, i) => `Pokemon${i}\n- Move`)
        .join("\n\n");

      const result = useTeamStore.getState().importTeam(paste);

      expect(result.success).toBe(false);
      expect(result.error).toContain("more than 6");
    });
  });

  describe("exportTeam", () => {
    it("should export team to Showdown format", () => {
      useTeamStore.getState().setPokemon(0, {
        pokemon: "Garchomp",
        item: "Life Orb",
        ability: "Rough Skin",
        moves: ["Earthquake"],
      });

      const exported = useTeamStore.getState().exportTeam();

      expect(exported).toContain("Garchomp @ Life Orb");
      expect(exported).toContain("Ability: Rough Skin");
      expect(exported).toContain("- Earthquake");
    });

    it("should export empty string for empty team", () => {
      const exported = useTeamStore.getState().exportTeam();
      expect(exported).toBe("");
    });
  });
});
