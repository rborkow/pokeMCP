const PUBLIC_MCP_PATHS = new Set(["/mcp", "/sse", "/sse/message", "/api/tools"]);

export function getRetirementResponse(pathname: string, method: string): Response | null {
    const retiresIntegration = PUBLIC_MCP_PATHS.has(pathname);
    const retiresStoredTeamCreation = pathname === "/api/team/share" && method === "POST";
    if (!retiresIntegration && !retiresStoredTeamCreation) return null;

    return new Response(
        JSON.stringify({
            error: "gone",
            message: retiresStoredTeamCreation
                ? "New stored team links have been retired. Existing /t/ links remain readable."
                : "The public PokeMCP integration has been retired. Analysis now powers PokeMCP Prep directly at https://www.pokemcp.com.",
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
