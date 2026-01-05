import type { NextRequest } from "next/server";
import { type PersonalityId, DEFAULT_PERSONALITY } from "@/lib/ai/personalities";
import {
  type TeamPokemon,
  fetchMetaThreats,
  fetchPopularSetsContext,
  formatTeamContext,
  buildSystemPrompt,
  buildUserMessage,
} from "@/lib/ai/context";

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
    const { message, team = [], format = "gen9ou", enableThinking, personality: personalityId = DEFAULT_PERSONALITY } = await request.json();

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

    // Fetch context in parallel
    const [metaThreats, popularSetsContext] = await Promise.all([
      fetchMetaThreats(format),
      fetchPopularSetsContext(message, format),
    ]);

    // Build prompts
    const teamContext = formatTeamContext(team as TeamPokemon[]);
    const systemPrompt = buildSystemPrompt(personalityId as PersonalityId, format, team.length);
    const fullUserMessage = buildUserMessage(teamContext, metaThreats, popularSetsContext, message, format);

    // Determine if we should use extended thinking
    const useThinking = enableThinking ?? shouldUseThinking(message);

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: useThinking ? 16000 : 1024,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: fullUserMessage }],
    };

    // Add thinking configuration if enabled
    if (useThinking) {
      requestBody.thinking = {
        type: "enabled",
        budget_tokens: 8000,
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
    let buffer = "";

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });

        const events = buffer.split("\n\n");
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

                if (parsed.type === "content_block_start") {
                  isThinking = parsed.content_block?.type === "thinking";
                  if (isThinking) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ thinking: true, text: "" })}\n\n`)
                    );
                  }
                }

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

                if (parsed.type === "content_block_stop" && isThinking) {
                  isThinking = false;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ thinking: false })}\n\n`)
                  );
                }

                if (parsed.type === "message_stop") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      },
      flush(controller) {
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
