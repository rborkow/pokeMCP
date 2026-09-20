import { z } from "zod";
import { Teams } from "./showdown.js";

export const statSchema = z.object({
    hp: z.number().int().min(0).max(32).default(0),
    atk: z.number().int().min(0).max(32).default(0),
    def: z.number().int().min(0).max(32).default(0),
    spa: z.number().int().min(0).max(32).default(0),
    spd: z.number().int().min(0).max(32).default(0),
    spe: z.number().int().min(0).max(32).default(0),
});

export const setSchema = z.object({
    species: z.string(),
    item: z.string().optional(),
    ability: z.string().optional(),
    moves: z.array(z.string()).max(4).default([]),
    nature: z.string().optional(),
    /** Champions Stat Points (0–32 each, 66 total). Kept in the EV slot for Showdown compatibility. */
    evs: statSchema.partial().optional(),
    level: z.number().int().default(50),
});
export type PokemonSet = z.infer<typeof setSchema>;

/** Every team-taking tool accepts either a Showdown paste or structured sets. */
export const teamInputSchema = {
    paste: z
        .string()
        .optional()
        .describe("Showdown export text (6 sets). EVs lines = Stat Points."),
    sets: z.array(setSchema).optional().describe("Structured sets; alternative to `paste`."),
};

export const SAMPLE_TEAM_PASTE = `Staraptor @ Staraptite
Ability: Intimidate
Level: 50
EVs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Close Combat
- Brave Bird
- Tailwind
- Protect

Raichu @ Raichunite Y
Ability: Lightning Rod
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Zap Cannon
- Focus Blast
- Fake Out
- Protect

Gholdengo @ Life Orb
Ability: Good as Gold
Level: 50
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Nasty Plot
- Protect

Rillaboom @ Miracle Seed
Ability: Grassy Surge
Level: 50
EVs: 32 HP / 32 Atk / 2 Def
Adamant Nature
- Wood Hammer
- Grassy Glide
- Fake Out
- U-turn

Kingambit @ Black Glasses
Ability: Defiant
Level: 50
EVs: 32 HP / 32 Atk / 2 Def
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Protect

Incineroar @ Sitrus Berry
Ability: Intimidate
Level: 50
EVs: 32 HP / 32 Def / 2 SpD
Careful Nature
- Flare Blitz
- Knock Off
- Fake Out
- Parting Shot`;

export function parseTeamInput(args: { paste?: string; sets?: unknown[] }): PokemonSet[] {
    if (args.paste?.trim()) {
        const imported = Teams.import(args.paste);
        if (!imported?.length) throw new Error("Could not parse any sets from `paste`.");
        return imported.map((s: Record<string, unknown>) => ({
            species: String(s.species),
            item: (s.item as string) || undefined,
            ability: (s.ability as string) || undefined,
            moves: (s.moves as string[]) ?? [],
            nature: (s.nature as string) || undefined,
            evs: (s.evs as Record<string, number>) ?? undefined,
            level: (s.level as number) || 50,
        }));
    }
    if (args.sets?.length) return args.sets.map((s) => setSchema.parse(s));
    throw new Error("Provide paste or sets (a Showdown paste string, or an array of sets).");
}

export function toPacked(team: PokemonSet[]): string {
    return Teams.pack(
        team.map((s) => ({
            name: s.species,
            species: s.species,
            item: s.item ?? "",
            ability: s.ability ?? "",
            moves: s.moves,
            nature: s.nature ?? "",
            evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(s.evs ?? {}) },
            ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
            level: s.level,
            gender: "",
        })),
    );
}
