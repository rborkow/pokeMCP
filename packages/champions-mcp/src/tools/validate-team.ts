import { CHAMPIONS_FORMAT_ID, Teams, TeamValidator } from "../showdown.js";
import { parseTeamInput, teamInputSchema, toPacked } from "../team.js";
import type { ToolDefinition } from "./registry.js";
import { sourceLine } from "./source.js";

export async function validateTeam(args: { paste?: string; sets?: unknown[] }): Promise<string> {
    const team = parseTeamInput(args);
    const validator = new TeamValidator(CHAMPIONS_FORMAT_ID);
    const problems: string[] = validator.validateTeam(Teams.unpack(toPacked(team))) ?? [];
    const header = `**Team validation — Reg M-C (${CHAMPIONS_FORMAT_ID})**\n${sourceLine()}\n`;
    if (problems.length === 0) return `${header}\n✅ Legal: ${team.length} Pokémon, no problems.`;
    const n = problems.length;
    return `${header}\n❌ ${n} problem${n === 1 ? "" : "s"}:\n${problems.map((p) => `- ${p}`).join("\n")}`;
}

export const validateTeamTool: ToolDefinition = {
    name: "validate_team",
    description:
        "Validate a Champions Reg M-C team with Pokémon Showdown's validator: roster legality, " +
        "Flat Rules bans, Species/Item clause, learnsets, and the 66 Stat Point (32 per stat) rule.",
    schema: teamInputSchema,
    execute: (args) => validateTeam(args as { paste?: string; sets?: unknown[] }),
};
