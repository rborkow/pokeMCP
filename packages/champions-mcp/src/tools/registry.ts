import type { ZodRawShape } from "zod";

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
];

export function findTool(name: string): ToolDefinition | undefined {
    return TOOLS.find((t) => t.name === name);
}
