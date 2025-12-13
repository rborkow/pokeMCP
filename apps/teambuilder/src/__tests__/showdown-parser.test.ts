import { describe, it, expect } from "vitest";
import { parseShowdownTeam, exportShowdownTeam, toID } from "@/lib/showdown-parser";

describe("parseShowdownTeam", () => {
  it("should parse a basic Pokemon", () => {
    const paste = `Garchomp @ Life Orb
Ability: Rough Skin
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Swords Dance
- Fire Fang`;

    const team = parseShowdownTeam(paste);
    expect(team).toHaveLength(1);
    expect(team[0]).toEqual({
      pokemon: "Garchomp",
      item: "Life Orb",
      ability: "Rough Skin",
      nature: "Jolly",
      evs: { atk: 252, spd: 4, spe: 252 },
      moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Fire Fang"],
    });
  });

  it("should parse Pokemon with nickname", () => {
    const paste = `Chompy (Garchomp) @ Life Orb
Ability: Rough Skin
- Earthquake`;

    const team = parseShowdownTeam(paste);
    expect(team[0].nickname).toBe("Chompy");
    expect(team[0].pokemon).toBe("Garchomp");
  });

  it("should parse Pokemon with gender", () => {
    const paste = `Garchomp (M) @ Life Orb
Ability: Rough Skin
- Earthquake`;

    const team = parseShowdownTeam(paste);
    expect(team[0].pokemon).toBe("Garchomp");
    expect(team[0].gender).toBe("M");
  });

  it("should parse multiple Pokemon", () => {
    const paste = `Garchomp @ Life Orb
Ability: Rough Skin
- Earthquake

Landorus-Therian @ Choice Scarf
Ability: Intimidate
- U-turn`;

    const team = parseShowdownTeam(paste);
    expect(team).toHaveLength(2);
    expect(team[0].pokemon).toBe("Garchomp");
    expect(team[1].pokemon).toBe("Landorus-Therian");
  });

  it("should parse Tera Type", () => {
    const paste = `Garchomp @ Life Orb
Ability: Rough Skin
Tera Type: Fire
- Earthquake`;

    const team = parseShowdownTeam(paste);
    expect(team[0].teraType).toBe("Fire");
  });

  it("should parse IVs", () => {
    const paste = `Garchomp
IVs: 0 Atk / 0 Spe
- Earthquake`;

    const team = parseShowdownTeam(paste);
    expect(team[0].ivs).toEqual({ atk: 0, spe: 0 });
  });

  it("should parse Level", () => {
    const paste = `Garchomp
Level: 50
- Earthquake`;

    const team = parseShowdownTeam(paste);
    expect(team[0].level).toBe(50);
  });

  it("should parse Shiny", () => {
    const paste = `Garchomp
Shiny: Yes
- Earthquake`;

    const team = parseShowdownTeam(paste);
    expect(team[0].shiny).toBe(true);
  });

  it("should handle Pokemon with no item", () => {
    const paste = `Garchomp
Ability: Rough Skin
- Earthquake`;

    const team = parseShowdownTeam(paste);
    expect(team[0].pokemon).toBe("Garchomp");
    expect(team[0].item).toBeUndefined();
  });

  it("should limit moves to 4", () => {
    const paste = `Garchomp
- Earthquake
- Dragon Claw
- Swords Dance
- Fire Fang
- Stone Edge`;

    const team = parseShowdownTeam(paste);
    expect(team[0].moves).toHaveLength(4);
  });

  it("should handle empty input", () => {
    const team = parseShowdownTeam("");
    expect(team).toHaveLength(0);
  });
});

describe("exportShowdownTeam", () => {
  it("should export a basic Pokemon", () => {
    const team = [
      {
        pokemon: "Garchomp",
        item: "Life Orb",
        ability: "Rough Skin",
        nature: "Jolly",
        evs: { atk: 252, spd: 4, spe: 252 },
        moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Fire Fang"],
      },
    ];

    const exported = exportShowdownTeam(team);
    expect(exported).toContain("Garchomp @ Life Orb");
    expect(exported).toContain("Ability: Rough Skin");
    expect(exported).toContain("Jolly Nature");
    expect(exported).toContain("EVs:");
    expect(exported).toContain("- Earthquake");
    expect(exported).toContain("- Dragon Claw");
    expect(exported).toContain("- Swords Dance");
    expect(exported).toContain("- Fire Fang");
  });

  it("should export Pokemon with nickname", () => {
    const team = [
      {
        pokemon: "Garchomp",
        nickname: "Chompy",
        moves: ["Earthquake"],
      },
    ];

    const exported = exportShowdownTeam(team);
    expect(exported).toContain("Chompy (Garchomp)");
  });

  it("should export Pokemon with gender", () => {
    const team = [
      {
        pokemon: "Garchomp",
        gender: "M" as const,
        moves: ["Earthquake"],
      },
    ];

    const exported = exportShowdownTeam(team);
    expect(exported).toContain("Garchomp (M)");
  });

  it("should export Tera Type", () => {
    const team = [
      {
        pokemon: "Garchomp",
        teraType: "Fire",
        moves: ["Earthquake"],
      },
    ];

    const exported = exportShowdownTeam(team);
    expect(exported).toContain("Tera Type: Fire");
  });

  it("should export Level if not 100", () => {
    const team = [
      {
        pokemon: "Garchomp",
        level: 50,
        moves: ["Earthquake"],
      },
    ];

    const exported = exportShowdownTeam(team);
    expect(exported).toContain("Level: 50");
  });

  it("should not export Level if 100", () => {
    const team = [
      {
        pokemon: "Garchomp",
        level: 100,
        moves: ["Earthquake"],
      },
    ];

    const exported = exportShowdownTeam(team);
    expect(exported).not.toContain("Level:");
  });

  it("should export Shiny", () => {
    const team = [
      {
        pokemon: "Garchomp",
        shiny: true,
        moves: ["Earthquake"],
      },
    ];

    const exported = exportShowdownTeam(team);
    expect(exported).toContain("Shiny: Yes");
  });

  it("should round-trip correctly", () => {
    const original = `Garchomp @ Life Orb
Ability: Rough Skin
Tera Type: Fire
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Swords Dance
- Fire Fang`;

    const parsed = parseShowdownTeam(original);
    const exported = exportShowdownTeam(parsed);
    const reparsed = parseShowdownTeam(exported);

    expect(reparsed).toEqual(parsed);
  });
});

describe("toID", () => {
  it("should lowercase and remove special characters", () => {
    expect(toID("Landorus-Therian")).toBe("landorustherian");
    expect(toID("Charizard-Mega-X")).toBe("charizardmegax");
    expect(toID("Mr. Mime")).toBe("mrmime");
    expect(toID("Nidoran-F")).toBe("nidoranf");
  });
});
