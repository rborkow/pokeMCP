export function retiredIntegrationResponse() {
    return Response.json(
        {
            error: "gone",
            message:
                "This address is no longer an MCP endpoint. Connect to the VGC Teambuilder connector at https://api.pokemcp.com/mcp.",
        },
        {
            status: 410,
            headers: { "Cache-Control": "public, max-age=3600" },
        },
    );
}
