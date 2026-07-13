function retired() {
    return Response.json(
        {
            error: "gone",
            message: "The browser-facing MCP proxy has been retired. Use PokeMCP Prep workflows instead.",
        },
        { status: 410, headers: { "Cache-Control": "public, max-age=3600" } },
    );
}

export const GET = retired;
export const POST = retired;
