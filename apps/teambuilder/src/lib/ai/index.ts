import type { TeamPokemon } from "@/types/pokemon";
import type { AIProvider, AIResponse, TeamAction } from "@/types/chat";
import { buildSystemPrompt } from "./prompts";

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
 * Send a chat message to the AI
 */
export async function sendChatMessage({
  message,
  team,
  format,
  provider,
}: SendChatMessageOptions): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt(format);

  // Call the appropriate API route
  const endpoint = provider === "claude" ? "/api/ai/claude" : "/api/ai/cloudflare";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: systemPrompt,
      message: message, // Send original message, not the formatted one - server adds context
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
