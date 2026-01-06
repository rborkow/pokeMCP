import type { TeamPokemon } from "@/types/pokemon";
import type { AIProvider, AIResponse, TeamAction, ChatMessage } from "@/types/chat";
import type { PersonalityId } from "./personalities";
import { validatePokemonData } from "@/lib/validation/pokemon";
import { type ModifyTeamInput, toolInputToTeamAction } from "./tools";

interface SendChatMessageOptions {
  message: string;
  team: TeamPokemon[];
  format: string;
  provider: AIProvider;
  personality?: PersonalityId;
  chatHistory?: ChatMessage[];
}

/**
 * Parse a tool input into a TeamAction
 */
function parseToolToAction(
  toolInput: ModifyTeamInput,
  team: TeamPokemon[],
  slotOffset: number = 0
): TeamAction | undefined {
  try {
    // Build the preview team
    const preview = [...team];
    const slot = toolInput.slot ?? team.length + slotOffset;

    if (toolInput.action_type === "remove_pokemon") {
      preview.splice(slot, 1);
    } else {
      const newPokemon: TeamPokemon = {
        pokemon: toolInput.pokemon || "",
        moves: toolInput.moves || [],
        ability: toolInput.ability,
        item: toolInput.item,
        nature: toolInput.nature,
        teraType: toolInput.tera_type,
        evs: toolInput.evs,
        ivs: toolInput.ivs,
      };

      if (toolInput.action_type === "add_pokemon") {
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

    // Build payload from tool input
    const payload: Partial<TeamPokemon> = {};
    if (toolInput.pokemon) payload.pokemon = toolInput.pokemon;
    if (toolInput.moves) payload.moves = toolInput.moves;
    if (toolInput.ability) payload.ability = toolInput.ability;
    if (toolInput.item) payload.item = toolInput.item;
    if (toolInput.nature) payload.nature = toolInput.nature;
    if (toolInput.tera_type) payload.teraType = toolInput.tera_type;
    if (toolInput.evs) payload.evs = toolInput.evs;
    if (toolInput.ivs) payload.ivs = toolInput.ivs;

    // Validate the payload for add/update operations
    let validationErrors = undefined;
    if (toolInput.action_type !== "remove_pokemon") {
      const validation = validatePokemonData(payload);
      if (!validation.valid) {
        validationErrors = validation.errors;
      }
    }

    // Map action type
    const typeMap: Record<string, TeamAction["type"]> = {
      add_pokemon: "add_pokemon",
      replace_pokemon: "replace_pokemon",
      update_pokemon: "update_moveset",
      remove_pokemon: "remove_pokemon",
    };

    return {
      type: typeMap[toolInput.action_type] || "add_pokemon",
      slot: slot,
      payload: payload,
      preview: preview.filter(Boolean),
      reason: toolInput.reason || "AI suggestion",
      validationErrors,
    };
  } catch (e) {
    console.error("Failed to parse tool to action:", e);
    return undefined;
  }
}

/**
 * Parse a single action data object into a TeamAction (legacy format)
 */
function parseActionData(
  actionData: Record<string, unknown>,
  team: TeamPokemon[],
  slotOffset: number = 0
): TeamAction | undefined {
  try {
    // Build the preview team
    const preview = [...team];
    const slot = (actionData.slot as number) ?? team.length + slotOffset;

    if (actionData.type === "remove_pokemon") {
      preview.splice(slot, 1);
    } else if (actionData.payload) {
      const payload = actionData.payload as Record<string, unknown>;
      const newPokemon: TeamPokemon = {
        pokemon: (payload.pokemon as string) || "",
        moves: (payload.moves as string[]) || [],
        ability: payload.ability as string | undefined,
        item: payload.item as string | undefined,
        nature: payload.nature as string | undefined,
        teraType: payload.teraType as string | undefined,
        evs: payload.evs as TeamPokemon["evs"],
        ivs: payload.ivs as TeamPokemon["ivs"],
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

    // Validate the payload for add/update operations
    const payload = (actionData.payload as Partial<TeamPokemon>) || {};
    let validationErrors = undefined;

    if (actionData.type !== "remove_pokemon" && payload) {
      const validation = validatePokemonData(payload);
      if (!validation.valid) {
        validationErrors = validation.errors;
      }
    }

    return {
      type: actionData.type as TeamAction["type"],
      slot: slot,
      payload: payload,
      preview: preview.filter(Boolean),
      reason: (actionData.reason as string) || "AI suggestion",
      validationErrors,
    };
  } catch (e) {
    console.error("Failed to parse action:", e);
    return undefined;
  }
}

/**
 * Parse ACTION blocks from AI response (supports multiple) - legacy format
 */
function parseActionsFromResponse(
  content: string,
  team: TeamPokemon[]
): TeamAction[] {
  const actionRegex = /\[ACTION\]([\s\S]*?)\[\/ACTION\]/g;
  const actions: TeamAction[] = [];
  let match;
  let currentTeam = [...team];

  while ((match = actionRegex.exec(content)) !== null) {
    try {
      const actionData = JSON.parse(match[1].trim());
      const action = parseActionData(actionData, currentTeam, actions.length);
      if (action) {
        actions.push(action);
        // Update current team for next action's preview
        currentTeam = action.preview;
      }
    } catch (e) {
      console.error("Failed to parse action:", e);
    }
  }

  return actions;
}

/**
 * Clean the AI response by removing the ACTION block for display
 */
function cleanResponseContent(content: string): string {
  return content.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/g, "").trim();
}

/**
 * Convert ChatMessage array to simplified format for API
 */
function formatChatHistory(messages: ChatMessage[]): { role: "user" | "assistant"; content: string }[] {
  return messages
    .filter(msg => msg.role !== "system" && !msg.isLoading && msg.content.trim())
    .map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));
}

/**
 * Send a chat message to the AI (non-streaming)
 */
export async function sendChatMessage({
  message,
  team,
  format,
  provider,
  personality,
  chatHistory = [],
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
      personality: personality,
      chatHistory: formatChatHistory(chatHistory),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const rawContent = data.content || data.message || "";

  // Parse any action from the response
  const actions = parseActionsFromResponse(rawContent, team);

  // Clean the content for display
  const content = cleanResponseContent(rawContent);

  return { content, action: actions[0], actions: actions.length > 1 ? actions : undefined };
}

interface StreamChatMessageOptions extends SendChatMessageOptions {
  onChunk: (text: string) => void;
  onThinking?: (isThinking: boolean, thinkingText?: string) => void;
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
  personality,
  chatHistory = [],
  onChunk,
  onThinking,
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
        personality,
        chatHistory: formatChatHistory(chatHistory),
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
    let thinkingContent = "";
    let isCurrentlyThinking = false;
    let buffer = ""; // Buffer for incomplete SSE events
    const toolCalls: ModifyTeamInput[] = []; // Accumulate tool calls

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Append new data to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events (they end with \n\n)
      const events = buffer.split("\n\n");
      // Keep the last potentially incomplete event in buffer
      buffer = events.pop() || "";

      for (const event of events) {
        const lines = event.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              // Stream complete - process final response
              // First check for tool calls, then fall back to legacy ACTION blocks
              let actions: TeamAction[] = [];

              if (toolCalls.length > 0) {
                // Convert tool calls to TeamActions
                let currentTeam = [...team];
                for (const toolInput of toolCalls) {
                  const action = parseToolToAction(toolInput, currentTeam, actions.length);
                  if (action) {
                    actions.push(action);
                    currentTeam = action.preview;
                  }
                }
              } else {
                // Fall back to parsing ACTION blocks from content
                actions = parseActionsFromResponse(fullContent, team);
              }

              const cleanedContent = cleanResponseContent(fullContent);
              onComplete({
                content: cleanedContent,
                action: actions[0],
                actions: actions.length > 1 ? actions : undefined,
                rawContent: fullContent,
              });
              return;
            }

            try {
              const parsed = JSON.parse(data);

              // Handle thinking state changes
              if (parsed.thinking !== undefined) {
                if (parsed.thinking === true && !isCurrentlyThinking) {
                  // Starting thinking
                  isCurrentlyThinking = true;
                  thinkingContent = "";
                  onThinking?.(true, "");
                } else if (parsed.thinking === false && isCurrentlyThinking) {
                  // Finished thinking
                  isCurrentlyThinking = false;
                  onThinking?.(false, thinkingContent);
                }

                // Accumulate thinking text
                if (parsed.thinking === true && parsed.text) {
                  thinkingContent += parsed.text;
                  onThinking?.(true, thinkingContent);
                }
              }

              // Handle regular text (non-thinking)
              if (parsed.text && !parsed.thinking) {
                fullContent += parsed.text;
                // Send cleaned content for display
                onChunk(cleanResponseContent(fullContent));
              }

              // Handle tool use
              if (parsed.tool_use) {
                const toolUse = parsed.tool_use;
                if (toolUse.name === "modify_team" && toolUse.input) {
                  toolCalls.push(toolUse.input as ModifyTeamInput);
                }
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.trim()) {
      const lines = buffer.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ") && line.slice(6) !== "[DONE]") {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text && !parsed.thinking) {
              fullContent += parsed.text;
            }
            if (parsed.tool_use?.name === "modify_team" && parsed.tool_use?.input) {
              toolCalls.push(parsed.tool_use.input as ModifyTeamInput);
            }
          } catch {
            // Skip
          }
        }
      }
    }

    // If we get here without [DONE], still complete
    let actions: TeamAction[] = [];

    if (toolCalls.length > 0) {
      let currentTeam = [...team];
      for (const toolInput of toolCalls) {
        const action = parseToolToAction(toolInput, currentTeam, actions.length);
        if (action) {
          actions.push(action);
          currentTeam = action.preview;
        }
      }
    } else {
      actions = parseActionsFromResponse(fullContent, team);
    }

    const cleanedContent = cleanResponseContent(fullContent);
    onComplete({
      content: cleanedContent,
      action: actions[0],
      actions: actions.length > 1 ? actions : undefined,
      rawContent: fullContent,
    });
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
