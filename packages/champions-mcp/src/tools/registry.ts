import type { ZodRawShape } from "zod";
import { calcDamageTool } from "./calc-damage.js";
import { calcStatsTool } from "./calc-stats.js";
import { getRegulationTool } from "./get-regulation.js";
import { lookupPokemonTool } from "./lookup-pokemon.js";
import { validateTeamTool } from "./validate-team.js";

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
];

export function findTool(name: string): ToolDefinition | undefined {
    return TOOLS.find((t) => t.name === name);
}
