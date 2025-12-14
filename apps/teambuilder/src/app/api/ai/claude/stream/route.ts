import { NextRequest } from "next/server";

interface TeamPokemon {
  pokemon: string;
  moves?: string[];
  ability?: string;
  item?: string;
}

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com";

// Keywords that trigger extended thinking for deeper analysis
const ANALYSIS_KEYWORDS = [
  "rate", "analyze", "review", "evaluate", "assess",
  "weakness", "threat", "counter", "check",
  "improve", "optimize", "better", "fix",
  "why", "explain", "strategy", "synergy"
];

function shouldUseThinking(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return ANALYSIS_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

export async function POST(request: NextRequest) {
  try {
    const { message, team = [], format = "gen9ou", enableThinking } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Claude API key not configured" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
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
        metaThreats = threatsData.result?.content?.[0]?.text || "";
      }
    } catch (e) {
      console.error("Failed to fetch meta threats:", e);
    }

    // Extract Pokemon names from message for targeted set lookups
    const pokemonMentioned: string[] = [];
    const commonPokemon = [
      "Garchomp", "Landorus", "Great Tusk", "Kingambit", "Gholdengo",
      "Dragapult", "Iron Valiant", "Roaring Moon", "Skeledirge",
      "Arcanine", "Heatran", "Toxapex"
    ];
    for (const mon of commonPokemon) {
      if (message.toLowerCase().includes(mon.toLowerCase())) {
        pokemonMentioned.push(mon);
      }
    }

    // Fetch popular sets for mentioned Pokemon
    let popularSetsContext = "";
    for (const pokemon of pokemonMentioned.slice(0, 3)) {
      try {
        const setsResponse = await fetch(`${MCP_URL}/api/tools`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "get_popular_sets",
            args: { pokemon, format },
          }),
        });
        if (setsResponse.ok) {
          const setsData = await setsResponse.json();
          const setsText = setsData.result?.content?.[0]?.text || "";
          if (setsText) {
            popularSetsContext += `\n\n${setsText}`;
          }
        }
      } catch (e) {
        console.error(`Failed to fetch sets for ${pokemon}:`, e);
      }
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

    // Build system prompt
    const teamSize = team.length;
    const systemPrompt = `You are a Pokemon competitive team building assistant for ${format.toUpperCase()}.

CRITICAL RULES:
1. ONLY suggest Pokemon that are legal in ${format.toUpperCase()}. Reference the meta threats list.
2. ONLY use moves from the "Popular Moves" section when provided. These are VERIFIED learnable moves.
3. If no popular sets are provided for a Pokemon, use ONLY standard competitive moves you are certain it can learn.
4. NEVER suggest moves like Trick Room, Wish, or other specialized moves unless you see them in the Popular Moves list.
5. Use REAL abilities from the "Popular Abilities" section when provided.
6. When suggesting team changes, you MUST use the [ACTION] block format shown below.
7. ALWAYS include competitive EV spreads (totaling 508-510 EVs). Common spreads:
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
- If suggesting to replace a Pokemon, reference which one by name and slot number
- When in doubt about a move, check the Popular Moves list or suggest a safe STAB move`;

    // Build user message with context
    let contextSection = "";
    if (metaThreats) {
      contextSection += `\n\n## Current Meta Threats (${format}):\n${metaThreats}`;
    }
    if (popularSetsContext) {
      contextSection += `\n\n## Popular Sets (USE THESE MOVES - they are verified legal):\n${popularSetsContext}`;
    }

    const fullUserMessage = `Current Team:
${teamContext}
${contextSection}

User's Question: ${message}`;

    // Determine if we should use extended thinking
    const useThinking = enableThinking ?? shouldUseThinking(message);

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: useThinking ? 16000 : 1024, // More tokens when thinking
      stream: true,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: fullUserMessage,
        },
      ],
    };

    // Add thinking configuration if enabled
    if (useThinking) {
      requestBody.thinking = {
        type: "enabled",
        budget_tokens: 8000, // Allow up to 8k tokens for thinking
      };
    }

    // Make streaming request to Claude
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Claude API request failed" }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Transform the Claude stream to a simpler format
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let isThinking = false;
    let buffer = ""; // Buffer for incomplete lines

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        // Append new chunk to buffer
        buffer += decoder.decode(chunk, { stream: true });

        // Process complete lines (SSE events end with \n\n)
        const events = buffer.split("\n\n");
        // Keep the last potentially incomplete event in buffer
        buffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const parsed = JSON.parse(data);

                // Handle content_block_start to track if we're in thinking mode
                if (parsed.type === "content_block_start") {
                  isThinking = parsed.content_block?.type === "thinking";
                  if (isThinking) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ thinking: true, text: "" })}\n\n`)
                    );
                  }
                }

                // Handle content_block_delta events
                if (parsed.type === "content_block_delta") {
                  if (parsed.delta?.thinking) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ thinking: true, text: parsed.delta.thinking })}\n\n`)
                    );
                  } else if (parsed.delta?.text) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`)
                    );
                  }
                }

                // Handle content_block_stop
                if (parsed.type === "content_block_stop" && isThinking) {
                  isThinking = false;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ thinking: false })}\n\n`)
                  );
                }

                // Handle message_stop to signal end
                if (parsed.type === "message_stop") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
              } catch {
                // Skip invalid JSON (incomplete data)
              }
            }
          }
        }
      },
      flush(controller) {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          const lines = buffer.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line.slice(6) !== "[DONE]") {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.delta?.text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`)
                  );
                }
              } catch {
                // Skip
              }
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      }
    });

    return new Response(response.body?.pipeThrough(transformStream), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Claude streaming error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process Claude request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
