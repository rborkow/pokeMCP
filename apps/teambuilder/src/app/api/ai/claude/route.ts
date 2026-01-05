import { NextResponse } from "next/server";
import { type PersonalityId, DEFAULT_PERSONALITY } from "@/lib/ai/personalities";
import {
  type TeamPokemon,
  fetchMetaThreats,
  fetchPopularSetsContext,
  formatTeamContext,
  buildSystemPrompt,
  buildUserMessage,
} from "@/lib/ai/context";

export async function POST(request: Request) {
  try {
    const { message, team = [], format = "gen9ou", personality: personalityId = DEFAULT_PERSONALITY } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Claude API key not configured. Please use Cloudflare AI instead." },
        { status: 503 }
      );
    }

    // Fetch context in parallel
    const [metaThreats, popularSetsContext] = await Promise.all([
      fetchMetaThreats(format),
      fetchPopularSetsContext(message, format),
    ]);

    // Build prompts
    const teamContext = formatTeamContext(team as TeamPokemon[]);
    const systemPrompt = buildSystemPrompt(personalityId as PersonalityId, format, team.length);
    const fullUserMessage = buildUserMessage(teamContext, metaThreats, popularSetsContext, message, format);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: fullUserMessage }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);
      let errorMessage = "Claude API request failed";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
      }
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Claude API error:", error);
    return NextResponse.json({ error: "Failed to process Claude request" }, { status: 500 });
  }
}
