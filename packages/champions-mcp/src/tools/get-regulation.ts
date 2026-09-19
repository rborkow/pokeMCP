import { CURRENT_REGULATION, legalMegas, legalSpecies, regulationStatus } from "../regulation.js";
import type { ToolDefinition } from "./registry.js";
import { sourceLine } from "./source.js";

export async function getRegulation(_args: Record<string, unknown>): Promise<string> {
    const r = CURRENT_REGULATION;
    const status = regulationStatus();
    const species = legalSpecies();
    const megas = legalMegas();
    const warn =
        status.state === "expired"
            ? "\n\n⚠️ **This regulation has ended.** Update `packages/champions-mcp/src/regulation.ts` and re-vendor Showdown (`bun run champions:vendor` with a new SHOWDOWN_SHA)."
            : "";
    return [
        `**${r.displayName}** — ${status.state}, ${status.daysLeft} days left (ends ${r.endDate})`,
        sourceLine(`dates from ${r.announcementUrl}`),
        "",
        `- Level ${r.level}, bring ${r.bringCount} of ${r.teamSize}, Species + Item clause`,
        `- Stat Points: ${r.statPointsTotal} total, max ${r.statPointsPerStat} per stat (HP = base + SP + 75; others = base + SP + 20, then nature)`,
        `- Legal species (${species.length}): ${species.join(", ")}`,
        `- Megas (${megas.length}): ${megas.map((m) => `${m.name} [${m.types.join("/")}, ${m.ability}, ${m.requiredItem}]`).join("; ")}`,
        warn,
    ].join("\n");
}

export const getRegulationTool: ToolDefinition = {
    name: "get_regulation",
    description:
        "Current Pokémon Champions regulation: dates, rules, full legal roster and Mega list. Call first in any team-building session.",
    schema: {},
    execute: getRegulation,
};
