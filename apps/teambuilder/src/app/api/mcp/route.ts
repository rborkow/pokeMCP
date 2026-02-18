import { NextResponse } from "next/server";

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Extract tool name and arguments from JSON-RPC format
        // Expected format: { method: "tools/call", params: { name: "tool_name", arguments: {...} } }
        const toolName = body.params?.name;
        const toolArgs = body.params?.arguments || {};

        if (!toolName) {
            return NextResponse.json(
                {
                    error: "Tool name is required",
                    jsonrpc: "2.0",
                    id: body.id || null,
                },
                { status: 400 },
            );
        }

        // Forward to the stateless /api/tools endpoint
        const response = await fetch(`${MCP_URL}/api/tools`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                tool: toolName,
                args: toolArgs,
                id: body.id,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("MCP proxy error:", response.status, errorText);
            return NextResponse.json(
                {
                    error: `MCP request failed: ${response.status}`,
                    details: errorText,
                    jsonrpc: "2.0",
                    id: body.id || null,
                },
                { status: response.status },
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("MCP proxy error:", error);
        return NextResponse.json(
            {
                error: "Failed to proxy MCP request",
                details: error instanceof Error ? error.message : "Unknown error",
                jsonrpc: "2.0",
                id: null,
            },
            { status: 500 },
        );
    }
}
