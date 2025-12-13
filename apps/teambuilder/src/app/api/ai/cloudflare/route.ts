import { NextResponse } from "next/server";

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com";

export async function POST(request: Request) {
  try {
    const { system, message, team, format } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Call the MCP server's AI chat endpoint
    const response = await fetch(`${MCP_URL}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system,
        message,
        team,
        format,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MCP AI chat error:", response.status, errorText);
      return NextResponse.json(
        { error: `AI request failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Cloudflare AI error:", error);
    return NextResponse.json(
      { error: "Failed to process AI request" },
      { status: 500 }
    );
  }
}
