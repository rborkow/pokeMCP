import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS } from "./tools/registry.js";

export function buildServer(): McpServer {
    const server = new McpServer({ name: "champions-mcp", version: "0.1.0" });
    for (const tool of TOOLS) {
        server.registerTool(
            tool.name,
            { description: tool.description, inputSchema: tool.schema },
            async (args) => ({
                content: [{ type: "text", text: await tool.execute(args ?? {}) }],
            }),
        );
    }
    return server;
}

export async function main(): Promise<void> {
    const server = buildServer();
    await server.connect(new StdioServerTransport());
}
