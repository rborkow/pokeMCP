export function retiredIntegrationResponse() {
    return Response.json(
        {
            error: "gone",
            message: "The public PokeMCP integration has been retired. Use PokeMCP Prep workflows instead.",
        },
        {
            status: 410,
            headers: { "Cache-Control": "public, max-age=3600" },
        },
    );
}
