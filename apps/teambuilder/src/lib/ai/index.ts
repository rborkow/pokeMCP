import type { TeamPokemon } from "@/types/pokemon";
import type { AIProvider, AIResponse, TeamAction } from "@/types/chat";

interface SendChatMessageOptions {
  message: string;
  team: TeamPokemon[];
  format: string;
  provider: AIProvider;
}

/**
 * Parse an ACTION block from AI response
 */
function parseActionFromResponse(
  content: string,
  team: TeamPokemon[]
): TeamAction | undefined {
  const actionMatch = content.match(/\[ACTION\]([\s\S]*?)\[\/ACTION\]/);
  if (!actionMatch) return undefined;

  try {
    const actionData = JSON.parse(actionMatch[1].trim());

    // Build the preview team
    const preview = [...team];
    const slot = actionData.slot ?? team.length;

    if (actionData.type === "remove_pokemon") {
      preview.splice(slot, 1);
    } else if (actionData.payload) {
      const newPokemon: TeamPokemon = {
        pokemon: actionData.payload.pokemon || "",
        moves: actionData.payload.moves || [],
        ability: actionData.payload.ability,
        item: actionData.payload.item,
        nature: actionData.payload.nature,
        teraType: actionData.payload.teraType,
        evs: actionData.payload.evs,
        ivs: actionData.payload.ivs,
      };

      if (actionData.type === "add_pokemon") {
        preview.push(newPokemon);
      } else {
        // Merge with existing for updates
        if (preview[slot]) {
          preview[slot] = { ...preview[slot], ...newPokemon };
        } else {
          preview[slot] = newPokemon;
        }
      }
    }

    return {
      type: actionData.type,
      slot: slot,
      payload: actionData.payload || {},
      preview: preview.filter(Boolean),
      reason: actionData.reason || "AI suggestion",
    };
  } catch (e) {
    console.error("Failed to parse action:", e);
    return undefined;
  }
}

/**
 * Clean the AI response by removing the ACTION block for display
 */
function cleanResponseContent(content: string): string {
  return content.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/g, "").trim();
}

/**
 * Send a chat message to the AI (non-streaming)
 */
export async function sendChatMessage({
  message,
  team,
  format,
  provider,
}: SendChatMessageOptions): Promise<AIResponse> {
  // Call the appropriate API route
  // Note: We don't send a system prompt - the server builds one with meta context
  const endpoint = provider === "claude" ? "/api/ai/claude" : "/api/ai/cloudflare";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: message,
      team: team,
      format: format,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const rawContent = data.content || data.message || "";

  // Parse any action from the response
  const action = parseActionFromResponse(rawContent, team);

  // Clean the content for display
  const content = cleanResponseContent(rawContent);

  return { content, action };
}

interface StreamChatMessageOptions extends SendChatMessageOptions {
  onChunk: (text: string) => void;
  onComplete: (response: AIResponse) => void;
  onError: (error: Error) => void;
}

/**
 * Send a chat message to Claude with streaming response
 */
export async function streamChatMessage({
  message,
  team,
  format,
  onChunk,
  onComplete,
  onError,
}: StreamChatMessageOptions): Promise<void> {
  try {
    const response = await fetch("/api/ai/claude/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        team,
        format,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `AI request failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            // Stream complete - process final response
            const action = parseActionFromResponse(fullContent, team);
            const cleanedContent = cleanResponseContent(fullContent);
            onComplete({ content: cleanedContent, action });
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullContent += parsed.text;
              // Send cleaned content for display
              onChunk(cleanResponseContent(fullContent));
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }

    // If we get here without [DONE], still complete
    const action = parseActionFromResponse(fullContent, team);
    const cleanedContent = cleanResponseContent(fullContent);
    onComplete({ content: cleanedContent, action });
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
