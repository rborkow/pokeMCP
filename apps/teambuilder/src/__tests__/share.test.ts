import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    encodeTeamForUrl,
    decodeTeamFromUrl,
    generateShareUrl,
    copyToClipboard,
} from "@/lib/share";
import type { TeamPokemon } from "@/types/pokemon";

const sampleTeam: TeamPokemon[] = [
    {
        pokemon: "Garchomp",
        item: "Life Orb",
        ability: "Rough Skin",
        nature: "Jolly",
        evs: { atk: 252, spd: 4, spe: 252 },
        moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Fire Fang"],
    },
];

const fullTeam: TeamPokemon[] = [
    {
        pokemon: "Garchomp",
        moves: ["Earthquake", "Dragon Claw"],
        item: "Life Orb",
        ability: "Rough Skin",
    },
    {
        pokemon: "Landorus-Therian",
        moves: ["U-turn", "Earthquake"],
        item: "Choice Scarf",
        ability: "Intimidate",
    },
    {
        pokemon: "Heatran",
        moves: ["Magma Storm", "Earth Power"],
        item: "Leftovers",
        ability: "Flash Fire",
    },
    {
        pokemon: "Toxapex",
        moves: ["Scald", "Recover"],
        item: "Rocky Helmet",
        ability: "Regenerator",
    },
    {
        pokemon: "Corviknight",
        moves: ["Brave Bird", "Roost"],
        item: "Leftovers",
        ability: "Pressure",
    },
    {
        pokemon: "Rillaboom",
        moves: ["Grassy Glide", "U-turn"],
        item: "Choice Band",
        ability: "Grassy Surge",
    },
];

describe("encodeTeamForUrl / decodeTeamFromUrl roundtrip", () => {
    it("roundtrips a single Pokemon team", () => {
        const encoded = encodeTeamForUrl(sampleTeam, "gen9ou");
        const decoded = decodeTeamFromUrl(encoded);
        expect(decoded).not.toBeNull();
        expect(decoded!.format).toBe("gen9ou");
        expect(decoded!.team[0].pokemon).toBe("Garchomp");
    });

    it("roundtrips a full 6-pokemon team", () => {
        const encoded = encodeTeamForUrl(fullTeam, "gen9ou");
        const decoded = decodeTeamFromUrl(encoded);
        expect(decoded).not.toBeNull();
        expect(decoded!.team).toHaveLength(6);
        expect(decoded!.team.map((p) => p.pokemon)).toEqual([
            "Garchomp",
            "Landorus-Therian",
            "Heatran",
            "Toxapex",
            "Corviknight",
            "Rillaboom",
        ]);
    });

    it("preserves format across encode/decode", () => {
        for (const format of ["gen9ou", "gen9ubers", "gen8ou", "gen9vgc2024regh"]) {
            const encoded = encodeTeamForUrl(sampleTeam, format);
            const decoded = decodeTeamFromUrl(encoded);
            expect(decoded!.format).toBe(format);
        }
    });

    it("preserves item, ability, nature, and moves", () => {
        const encoded = encodeTeamForUrl(sampleTeam, "gen9ou");
        const decoded = decodeTeamFromUrl(encoded);
        const p = decoded!.team[0];
        expect(p.item).toBe("Life Orb");
        expect(p.ability).toBe("Rough Skin");
        expect(p.nature).toBe("Jolly");
        expect(p.moves).toEqual(["Earthquake", "Dragon Claw", "Swords Dance", "Fire Fang"]);
    });

    it("preserves EVs", () => {
        const encoded = encodeTeamForUrl(sampleTeam, "gen9ou");
        const decoded = decodeTeamFromUrl(encoded);
        expect(decoded!.team[0].evs).toEqual({ atk: 252, spd: 4, spe: 252 });
    });
});

describe("encodeTeamForUrl", () => {
    it("returns empty string for empty team", () => {
        expect(encodeTeamForUrl([], "gen9ou")).toBe("");
    });

    it("produces URL-safe base64 (no +, /, or = chars)", () => {
        const encoded = encodeTeamForUrl(fullTeam, "gen9ou");
        expect(encoded).not.toMatch(/[+/=]/);
    });
});

describe("decodeTeamFromUrl", () => {
    it("returns null for empty string", () => {
        expect(decodeTeamFromUrl("")).toBeNull();
    });

    it("returns null for invalid base64", () => {
        expect(decodeTeamFromUrl("!!!not-valid!!!")).toBeNull();
    });

    it("defaults to gen9ou when no format prefix found", () => {
        // Encode raw showdown text without the format\n---\n prefix
        const raw = btoa("Garchomp\n- Earthquake")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
        const decoded = decodeTeamFromUrl(raw);
        expect(decoded).not.toBeNull();
        expect(decoded!.format).toBe("gen9ou");
    });
});

describe("generateShareUrl", () => {
    it("returns empty string for empty team", () => {
        expect(generateShareUrl([], "gen9ou")).toBe("");
    });

    it("produces a URL with ?team= parameter", () => {
        const url = generateShareUrl(sampleTeam, "gen9ou");
        expect(url).toContain("?team=");
    });

    it("starts with the current origin", () => {
        const url = generateShareUrl(sampleTeam, "gen9ou");
        // jsdom provides http://localhost
        expect(url).toMatch(/^http/);
    });
});

describe("copyToClipboard", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("uses navigator.clipboard.writeText when available", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText } });
        Object.defineProperty(window, "isSecureContext", { value: true, writable: true });

        const result = await copyToClipboard("test text");
        expect(writeText).toHaveBeenCalledWith("test text");
        expect(result).toBe(true);
    });

    it("returns false when clipboard API fails", async () => {
        const writeText = vi.fn().mockRejectedValue(new Error("denied"));
        Object.assign(navigator, { clipboard: { writeText } });
        Object.defineProperty(window, "isSecureContext", { value: true, writable: true });

        const result = await copyToClipboard("test text");
        expect(result).toBe(false);
    });
});
