import type { ZodRawShape } from "zod";
import { calcDamageTool } from "./calc-damage.js";
import { calcStatsTool } from "./calc-stats.js";
import { getRegulationTool } from "./get-regulation.js";
import { getTournamentTeamsTool } from "./get-tournament-teams.js";
import { getUsageTool } from "./get-usage.js";
import { gradeLeadsTool } from "./grade-leads.js";
import { lookupPokemonTool } from "./lookup-pokemon.js";
import { metaSnapshotTool } from "./meta-snapshot.js";
import { evaluateTeamTool, simulateMatchupTool } from "./simulate.js";
import { triageLossesTool } from "./triage-losses.js";
import { validateTeamTool } from "./validate-team.js";
import {
    compareRunsTool,
    getRunTool,
    listFindingsTool,
    listRunsTool,
    recordFindingTool,
    replayRunTool,
} from "./memory.js";

export interface ToolDefinition<S extends ZodRawShape = ZodRawShape> {
    name: string;
    description: string;
    schema: S;
    /** Returns Markdown/text. Throw on invalid input; the server reports it as an MCP error. */
    execute: (args: Record<string, unknown>) => Promise<string>;
}

export const TOOLS: ToolDefinition[] = [
    {
        name: "ping",
        description: "Health check for the champions-mcp server.",
        schema: {},
        execute: async () => "champions-mcp ok",
    },
    validateTeamTool,
    getRegulationTool,
    lookupPokemonTool,
    calcStatsTool,
    calcDamageTool,
    getUsageTool,
    getTournamentTeamsTool,
    metaSnapshotTool,
    simulateMatchupTool,
    evaluateTeamTool,
    gradeLeadsTool,
    triageLossesTool,
    getRunTool,
    listRunsTool,
    replayRunTool,
    compareRunsTool,
    recordFindingTool,
    listFindingsTool,
];

export function findTool(name: string): ToolDefinition | undefined {
    return TOOLS.find((t) => t.name === name);
}
