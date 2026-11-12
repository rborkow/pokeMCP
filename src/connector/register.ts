import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CONNECTOR_TOOLS } from "./tools.js";
import type { ToolOutcome } from "./types.js";

/**
 * Every connector tool only reads data this service hosts: nothing is
 * written, nothing is destroyed, repeating a call is harmless, and the tools
 * never reach an open-ended set of external entities. Directory reviews
 * require these hints to be explicit on each tool.
 */
export const READ_ONLY_ANNOTATIONS = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
} as const;

export interface ConnectorCallInfo {
    tool: string;
    format?: string;
    success: boolean;
    durationMs: number;
}

/**
 * Register the public connector tools on an MCP server.
 *
 * Kept free of Workers-only imports so the whole surface can be exercised in
 * tests through the SDK's in-memory transport.
 */
export function registerConnectorTools(
    server: McpServer,
    env: Env,
    onCall?: (info: ConnectorCallInfo) => void,
): void {
    for (const tool of CONNECTOR_TOOLS) {
        server.registerTool(
            tool.name,
            {
                title: tool.title,
                description: tool.description,
                inputSchema: tool.inputSchema,
                outputSchema: tool.outputSchema,
                annotations: { title: tool.title, ...READ_ONLY_ANNOTATIONS },
            },
            async (args: Record<string, unknown>) => {
                const started = Date.now();
                let outcome: ToolOutcome;
                try {
                    outcome = await tool.run(args, env);
                } catch (error) {
                    console.error(`Connector tool ${tool.name} failed:`, error);
                    outcome = {
                        ok: false,
                        message:
                            "VGC Teambuilder couldn't load the data for this request. " +
                            "Please try again in a moment.",
                    };
                }
                onCall?.({
                    tool: tool.name,
                    format: typeof args.format === "string" ? args.format : undefined,
                    success: outcome.ok,
                    durationMs: Date.now() - started,
                });

                if (outcome.ok === false) {
                    return {
                        content: [{ type: "text" as const, text: outcome.message }],
                        isError: true,
                    };
                }
                return {
                    content: [{ type: "text" as const, text: outcome.text }],
                    structuredContent: outcome.data,
                };
            },
        );
    }
}
