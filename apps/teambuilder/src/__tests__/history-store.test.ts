import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore } from "@/stores/history-store";
import type { TeamPokemon } from "@/types/pokemon";

describe("history-store", () => {
  beforeEach(() => {
    // Reset store between tests
    useHistoryStore.getState().clearHistory();
  });

  describe("pushState", () => {
    it("should add a history entry", () => {
      const team: TeamPokemon[] = [
        { pokemon: "Garchomp", moves: ["Earthquake"] },
      ];

      useHistoryStore.getState().pushState(team, "Added Garchomp", "user");
      const entries = useHistoryStore.getState().entries;

      expect(entries).toHaveLength(1);
      expect(entries[0].team).toEqual(team);
      expect(entries[0].reason).toBe("Added Garchomp");
      expect(entries[0].source).toBe("user");
    });

    it("should prepend new entries", () => {
      const team1: TeamPokemon[] = [{ pokemon: "Garchomp", moves: [] }];
      const team2: TeamPokemon[] = [
        { pokemon: "Garchomp", moves: [] },
        { pokemon: "Landorus-Therian", moves: [] },
      ];

      useHistoryStore.getState().pushState(team1, "First", "user");
      useHistoryStore.getState().pushState(team2, "Second", "user");

      const entries = useHistoryStore.getState().entries;
      expect(entries).toHaveLength(2);
      expect(entries[0].reason).toBe("Second");
      expect(entries[1].reason).toBe("First");
    });

    it("should limit history to 50 entries", () => {
      for (let i = 0; i < 60; i++) {
        useHistoryStore.getState().pushState(
          [{ pokemon: `Pokemon${i}`, moves: [] }],
          `Entry ${i}`,
          "user"
        );
      }

      const entries = useHistoryStore.getState().entries;
      expect(entries).toHaveLength(50);
    });
  });

  describe("calculateDiff", () => {
    const { calculateDiff } = useHistoryStore.getState();

    it("should detect added Pokemon", () => {
      const before: TeamPokemon[] = [];
      const after: TeamPokemon[] = [{ pokemon: "Garchomp", moves: [] }];

      const diff = calculateDiff(before, after);

      expect(diff.added).toHaveLength(1);
      expect(diff.added[0].pokemon).toBe("Garchomp");
      expect(diff.removed).toHaveLength(0);
      expect(diff.modified).toHaveLength(0);
    });

    it("should detect removed Pokemon", () => {
      const before: TeamPokemon[] = [{ pokemon: "Garchomp", moves: [] }];
      const after: TeamPokemon[] = [];

      const diff = calculateDiff(before, after);

      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(1);
      expect(diff.removed[0].pokemon).toBe("Garchomp");
      expect(diff.modified).toHaveLength(0);
    });

    it("should detect modified Pokemon - moves changed", () => {
      const before: TeamPokemon[] = [{ pokemon: "Garchomp", moves: ["Earthquake"] }];
      const after: TeamPokemon[] = [{ pokemon: "Garchomp", moves: ["Dragon Claw"] }];

      const diff = calculateDiff(before, after);

      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].changes).toContain("moves");
    });

    it("should detect modified Pokemon - item changed", () => {
      const before: TeamPokemon[] = [{ pokemon: "Garchomp", moves: [], item: "Life Orb" }];
      const after: TeamPokemon[] = [{ pokemon: "Garchomp", moves: [], item: "Choice Scarf" }];

      const diff = calculateDiff(before, after);

      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].changes).toContain("item");
    });

    it("should detect modified Pokemon - ability changed", () => {
      const before: TeamPokemon[] = [{ pokemon: "Garchomp", moves: [], ability: "Rough Skin" }];
      const after: TeamPokemon[] = [{ pokemon: "Garchomp", moves: [], ability: "Sand Veil" }];

      const diff = calculateDiff(before, after);

      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].changes).toContain("ability");
    });

    it("should detect modified Pokemon - EVs changed", () => {
      const before: TeamPokemon[] = [{ pokemon: "Garchomp", moves: [], evs: { atk: 252 } }];
      const after: TeamPokemon[] = [{ pokemon: "Garchomp", moves: [], evs: { spa: 252 } }];

      const diff = calculateDiff(before, after);

      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].changes).toContain("evs");
    });

    it("should detect modified Pokemon - nature changed", () => {
      const before: TeamPokemon[] = [{ pokemon: "Garchomp", moves: [], nature: "Jolly" }];
      const after: TeamPokemon[] = [{ pokemon: "Garchomp", moves: [], nature: "Adamant" }];

      const diff = calculateDiff(before, after);

      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].changes).toContain("nature");
    });

    it("should handle replacement (different Pokemon in same slot)", () => {
      const before: TeamPokemon[] = [{ pokemon: "Garchomp", moves: [] }];
      const after: TeamPokemon[] = [{ pokemon: "Landorus-Therian", moves: [] }];

      const diff = calculateDiff(before, after);

      // When Pokemon is replaced, it should show as removed + added
      expect(diff.removed).toHaveLength(1);
      expect(diff.removed[0].pokemon).toBe("Garchomp");
      expect(diff.added).toHaveLength(1);
      expect(diff.added[0].pokemon).toBe("Landorus-Therian");
    });

    it("should handle complex changes", () => {
      const before: TeamPokemon[] = [
        { pokemon: "Garchomp", moves: ["Earthquake"] },
        { pokemon: "Landorus-Therian", moves: ["U-turn"] },
      ];
      const after: TeamPokemon[] = [
        { pokemon: "Garchomp", moves: ["Dragon Claw"] }, // modified
        { pokemon: "Kingambit", moves: ["Sucker Punch"] }, // replaced Landorus
        { pokemon: "Gholdengo", moves: ["Make It Rain"] }, // added
      ];

      const diff = calculateDiff(before, after);

      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].before.pokemon).toBe("Garchomp");
      expect(diff.removed).toHaveLength(1);
      expect(diff.removed[0].pokemon).toBe("Landorus-Therian");
      expect(diff.added).toHaveLength(2); // Kingambit and Gholdengo
    });
  });

  describe("clearHistory", () => {
    it("should clear all entries", () => {
      useHistoryStore.getState().pushState(
        [{ pokemon: "Garchomp", moves: [] }],
        "user",
        "Test"
      );

      useHistoryStore.getState().clearHistory();
      const entries = useHistoryStore.getState().entries;

      expect(entries).toHaveLength(0);
    });
  });
});
