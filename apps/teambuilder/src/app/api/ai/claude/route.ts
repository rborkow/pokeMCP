import { NextResponse } from "next/server";

interface TeamPokemon {
  pokemon: string;
  moves?: string[];
  ability?: string;
  item?: string;
}

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com";

export async function POST(request: Request) {
  try {
    const { message, team = [], format = "gen9ou" } = await request.json();

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

    // Fetch meta threats from MCP server for context
    let metaThreats = "";
    try {
      const threatsResponse = await fetch(`${MCP_URL}/api/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "get_meta_threats",
          args: { format, limit: 15 },
        }),
      });
      if (threatsResponse.ok) {
        const threatsData = await threatsResponse.json();
        metaThreats = threatsData.result || "";
      }
    } catch (e) {
      console.error("Failed to fetch meta threats:", e);
    }

    // Format team for context
    const teamContext = team.length > 0
      ? team.map((p: TeamPokemon, i: number) => {
          const parts = [`${i + 1}. ${p.pokemon}`];
          if (p.item) parts.push(`@ ${p.item}`);
          if (p.ability) parts.push(`(${p.ability})`);
          if (p.moves && p.moves.length > 0) parts.push(`- Moves: ${p.moves.join(", ")}`);
          return parts.join(" ");
        }).join("\n")
      : "No Pokemon in team yet.";

    // Build system prompt (same as MCP server)
    const teamSize = team.length;
    const systemPrompt = `You are a Pokemon competitive team building assistant for ${format.toUpperCase()}.

IMPORTANT RULES:
1. ONLY suggest Pokemon that are legal in ${format.toUpperCase()}. The meta threats list below shows which Pokemon are available.
2. Use REAL abilities, moves, and items that actually exist. Never make up abilities.
3. When suggesting team changes, you MUST use the [ACTION] block format shown below.
4. ALWAYS include competitive EV spreads (totaling 508-510 EVs). Common spreads:
   - Offensive: 252 Atk or SpA / 4 Def or SpD / 252 Spe
   - Bulky: 252 HP / 252 Def or SpD / 4 Atk or SpA
   - Mixed bulk: 252 HP / 128 Def / 128 SpD

CURRENT TEAM STATUS:
- Team has ${teamSize} Pokemon (slots 0-${teamSize - 1} are filled, slots ${teamSize}-5 are empty)
- Use "add_pokemon" ONLY for empty slots (${teamSize > 5 ? "team is full!" : `slot ${teamSize} is the next empty slot`})
- Use "replace_pokemon" to swap out an existing Pokemon at their slot
- Use "update_moveset" to modify moves/item/ability of an existing Pokemon without replacing it

When suggesting a specific team change, wrap it in [ACTION] tags like this:

[ACTION]
{"type":"add_pokemon","slot":${teamSize},"payload":{"pokemon":"Great Tusk","moves":["Headlong Rush","Close Combat","Ice Spinner","Rapid Spin"],"ability":"Protosynthesis","item":"Booster Energy","nature":"Jolly","teraType":"Ground","evs":{"hp":0,"atk":252,"def":4,"spa":0,"spd":0,"spe":252}},"reason":"Adds Ground coverage and hazard removal"}
[/ACTION]

Guidelines:
- Be concise and actionable
- Reference the meta threats when suggesting counters
- Explain type synergies briefly
- Only suggest changes when the user asks for them
- If suggesting to replace a Pokemon, reference which one by name and slot number`;

    // Build user message with context
    let contextSection = "";
    if (metaThreats) {
      contextSection += `\n\n## Current Meta Threats (${format}):\n${metaThreats}`;
    }

    const fullUserMessage = `Current Team:
${teamContext}
${contextSection}

User's Question: ${message}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: fullUserMessage,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      return NextResponse.json(
        { error: "Claude API request failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Claude API error:", error);
    return NextResponse.json(
      { error: "Failed to process Claude request" },
      { status: 500 }
    );
  }
}
