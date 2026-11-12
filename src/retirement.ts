// Legacy integration endpoints that stay retired. The public MCP endpoint
// itself (`/mcp`, Streamable HTTP) is live again as the VGC Teambuilder connector.
const RETIRED_INTEGRATION_PATHS = new Set(["/sse", "/sse/message", "/api/tools"]);

export function getRetirementResponse(pathname: string, method: string): Response | null {
    const retiresIntegration = RETIRED_INTEGRATION_PATHS.has(pathname);
    const retiresStoredTeamCreation = pathname === "/api/team/share" && method === "POST";
    if (!retiresIntegration && !retiresStoredTeamCreation) return null;

    return new Response(
        JSON.stringify({
            error: "gone",
            message: retiresStoredTeamCreation
                ? "New stored team links have been retired. Existing /t/ links remain readable."
                : "This endpoint has been retired. Connect an MCP client over Streamable HTTP at https://api.pokemcp.com/mcp.",
        }),
        {
            status: 410,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=3600",
            },
        },
    );
}
