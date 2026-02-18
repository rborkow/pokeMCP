import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    getTwitterShareUrl,
    getRedditShareUrl,
    formatDiscordMessage,
    downloadTeamAsJson,
} from "@/lib/social-share";
import type { TeamPokemon } from "@/types/pokemon";

const sampleTeam: TeamPokemon[] = [
    {
        pokemon: "Garchomp",
        moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Fire Fang"],
        item: "Life Orb",
        ability: "Rough Skin",
    },
    {
        pokemon: "Landorus-Therian",
        moves: ["U-turn", "Earthquake"],
        item: "Choice Scarf",
        ability: "Intimidate",
    },
];

describe("getTwitterShareUrl", () => {
    it("returns a twitter.com/intent/tweet URL", () => {
        const url = getTwitterShareUrl("https://pokemcp.com/t/abc", "gen9ou", sampleTeam);
        expect(url).toContain("https://twitter.com/intent/tweet?");
    });

    it("includes all Pokemon names in the text", () => {
        const url = getTwitterShareUrl("https://pokemcp.com/t/abc", "gen9ou", sampleTeam);
        const params = new URLSearchParams(url.split("?")[1]);
        const text = params.get("text")!;
        expect(text).toContain("Garchomp");
        expect(text).toContain("Landorus-Therian");
    });

    it("includes the format display name", () => {
        const url = getTwitterShareUrl("https://pokemcp.com/t/abc", "gen9ou", sampleTeam);
        const params = new URLSearchParams(url.split("?")[1]);
        const text = params.get("text")!;
        expect(text).toContain("Gen 9 OU");
    });

    it("includes the team URL as the url parameter", () => {
        const teamUrl = "https://pokemcp.com/t/abc123";
        const url = getTwitterShareUrl(teamUrl, "gen9ou", sampleTeam);
        const params = new URLSearchParams(url.split("?")[1]);
        expect(params.get("url")).toBe(teamUrl);
    });

    it("handles single Pokemon team", () => {
        const team: TeamPokemon[] = [{ pokemon: "Pikachu", moves: ["Thunderbolt"] }];
        const url = getTwitterShareUrl("https://pokemcp.com/t/abc", "gen9ou", team);
        const params = new URLSearchParams(url.split("?")[1]);
        expect(params.get("text")).toContain("Pikachu");
    });
});

describe("getRedditShareUrl", () => {
    it("returns a reddit.com/submit URL", () => {
        const url = getRedditShareUrl("https://pokemcp.com/t/abc", "gen9ou", sampleTeam);
        expect(url).toContain("https://reddit.com/submit?");
    });

    it("includes format and Pokemon in the title", () => {
        const url = getRedditShareUrl("https://pokemcp.com/t/abc", "gen9ou", sampleTeam);
        const params = new URLSearchParams(url.split("?")[1]);
        const title = params.get("title")!;
        expect(title).toContain("Gen 9 OU");
        expect(title).toContain("Garchomp");
        expect(title).toContain("Landorus-Therian");
    });

    it("includes the team URL as the url parameter", () => {
        const teamUrl = "https://pokemcp.com/t/abc123";
        const url = getRedditShareUrl(teamUrl, "gen9ou", sampleTeam);
        const params = new URLSearchParams(url.split("?")[1]);
        expect(params.get("url")).toBe(teamUrl);
    });
});

describe("formatDiscordMessage", () => {
    it("starts with bold format name", () => {
        const msg = formatDiscordMessage(sampleTeam, "gen9ou", "https://pokemcp.com/t/abc");
        expect(msg).toMatch(/^\*\*Gen 9 OU/);
    });

    it("lists Pokemon with blockquote prefix", () => {
        const msg = formatDiscordMessage(sampleTeam, "gen9ou", "https://pokemcp.com/t/abc");
        expect(msg).toContain("> **Garchomp**");
        expect(msg).toContain("> **Landorus-Therian**");
    });

    it("includes item after @ when present", () => {
        const msg = formatDiscordMessage(sampleTeam, "gen9ou", "https://pokemcp.com/t/abc");
        expect(msg).toContain("@ Life Orb");
        expect(msg).toContain("@ Choice Scarf");
    });

    it("includes ability in parentheses when present", () => {
        const msg = formatDiscordMessage(sampleTeam, "gen9ou", "https://pokemcp.com/t/abc");
        expect(msg).toContain("(Rough Skin)");
        expect(msg).toContain("(Intimidate)");
    });

    it("lists moves separated by /", () => {
        const msg = formatDiscordMessage(sampleTeam, "gen9ou", "https://pokemcp.com/t/abc");
        expect(msg).toContain("Earthquake / Dragon Claw / Swords Dance / Fire Fang");
    });

    it("omits item/ability when not set", () => {
        const team: TeamPokemon[] = [{ pokemon: "Ditto", moves: ["Transform"] }];
        const msg = formatDiscordMessage(team, "gen9ou", "https://pokemcp.com/t/abc");
        expect(msg).not.toContain("@");
        expect(msg).not.toContain("(");
        expect(msg).toContain("> **Ditto**");
    });

    it("ends with the team URL", () => {
        const url = "https://pokemcp.com/t/abc123";
        const msg = formatDiscordMessage(sampleTeam, "gen9ou", url);
        expect(msg.trimEnd().endsWith(url)).toBe(true);
    });

    it("handles empty moves array", () => {
        const team: TeamPokemon[] = [{ pokemon: "Ditto", moves: [] }];
        const msg = formatDiscordMessage(team, "gen9ou", "https://pokemcp.com/t/abc");
        expect(msg).toContain("> **Ditto**");
    });
});

describe("downloadTeamAsJson", () => {
    let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockAnchor = { href: "", download: "", click: vi.fn() };
        vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLElement);
        vi.spyOn(document.body, "appendChild").mockReturnValue(null as unknown as Node);
        vi.spyOn(document.body, "removeChild").mockReturnValue(null as unknown as Node);
        vi.stubGlobal("URL", {
            createObjectURL: vi.fn(() => "blob:http://test/abc"),
            revokeObjectURL: vi.fn(),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("creates an anchor element and clicks it", () => {
        downloadTeamAsJson(sampleTeam, "gen9ou");
        expect(document.createElement).toHaveBeenCalledWith("a");
        expect(mockAnchor.click).toHaveBeenCalled();
    });

    it("uses format in the filename", () => {
        downloadTeamAsJson(sampleTeam, "gen9ou");
        expect(mockAnchor.download).toBe("team-gen9ou.json");
    });

    it("cleans up by removing anchor and revoking URL", () => {
        downloadTeamAsJson(sampleTeam, "gen9ou");
        expect(document.body.removeChild).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:http://test/abc");
    });
});
