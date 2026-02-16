import type { TeamPokemon, Mode } from "@/types/pokemon";
import type { AIResponse, TeamAction, ChatMessage } from "@/types/chat";
import type { PersonalityId } from "./personalities";
import { validatePokemonData } from "@/lib/validation/pokemon";
import type { ModifyTeamInput } from "./tools";

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
    } else if (toolInput.action_type === "add_pokemon" || toolInput.action_type === "replace_pokemon") {
      // For add/replace, create a new Pokemon with all provided fields
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
        // Full replacement at slot
        preview[slot] = newPokemon;
      }
    } else if (toolInput.action_type === "update_pokemon") {
      // For updates, only merge provided fields (preserve existing data)
      const updates: Partial<TeamPokemon> = {};
      if (toolInput.pokemon !== undefined) updates.pokemon = toolInput.pokemon;
      if (toolInput.moves !== undefined && toolInput.moves.length > 0) updates.moves = toolInput.moves;
      if (toolInput.ability !== undefined) updates.ability = toolInput.ability;
      if (toolInput.item !== undefined) updates.item = toolInput.item;
      if (toolInput.nature !== undefined) updates.nature = toolInput.nature;
      if (toolInput.tera_type !== undefined) updates.teraType = toolInput.tera_type;
      if (toolInput.evs !== undefined) updates.evs = toolInput.evs;
      if (toolInput.ivs !== undefined) updates.ivs = toolInput.ivs;

      if (preview[slot]) {
        preview[slot] = { ...preview[slot], ...updates };
      } else {
        // No existing Pokemon at slot - treat as add
        preview[slot] = {
          pokemon: toolInput.pokemon || "",
          moves: toolInput.moves || [],
          ability: toolInput.ability,
          item: toolInput.item,
          nature: toolInput.nature,
          teraType: toolInput.tera_type,
          evs: toolInput.evs,
          ivs: toolInput.ivs,
        };
      }
    }

    // Build payload from tool input (only include non-empty fields)
    const payload: Partial<TeamPokemon> = {};
    if (toolInput.pokemon) payload.pokemon = toolInput.pokemon;
    if (toolInput.moves && toolInput.moves.length > 0) payload.moves = toolInput.moves;
    if (toolInput.ability) payload.ability = toolInput.ability;
    if (toolInput.item) payload.item = toolInput.item;
    if (toolInput.nature) payload.nature = toolInput.nature;
    if (toolInput.tera_type) payload.teraType = toolInput.tera_type;
    if (toolInput.evs) payload.evs = toolInput.evs;
    if (toolInput.ivs) payload.ivs = toolInput.ivs;

    // Validate the payload for add/update operations
    let validationErrors ;
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

interface StreamChatMessageOptions {
  message: string;
  team: TeamPokemon[];
  format: string;
  mode?: Mode;
  personality?: PersonalityId;
  chatHistory?: ChatMessage[];
  onChunk: (text: string) => void;
  onThinking?: (isThinking: boolean, thinkingText?: string) => void;
  onToolUse?: (pokemonName: string, toolCount: number) => void;
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
  mode = "singles",
  personality,
  chatHistory = [],
  onChunk,
  onThinking,
  onToolUse,
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
        mode,
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
              // Stream complete - convert tool calls to TeamActions
              const actions: TeamAction[] = [];
              let currentTeam = [...team];
              for (const toolInput of toolCalls) {
                const action = parseToolToAction(toolInput, currentTeam, actions.length);
                if (action) {
                  actions.push(action);
                  currentTeam = action.preview;
                }
              }

              onComplete({
                content: fullContent,
                action: actions[0],
                actions: actions.length > 1 ? actions : undefined,
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
                onChunk(fullContent);
              }

              // Handle tool use
              if (parsed.tool_use) {
                const toolUse = parsed.tool_use;
                if (toolUse.name === "modify_team" && toolUse.input) {
                  const input = toolUse.input as ModifyTeamInput;
                  toolCalls.push(input);
                  // Notify about the tool use with Pokemon name
                  onToolUse?.(input.pokemon || "Pokemon", toolCalls.length);
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
    const actions: TeamAction[] = [];
    let currentTeam = [...team];
    for (const toolInput of toolCalls) {
      const action = parseToolToAction(toolInput, currentTeam, actions.length);
      if (action) {
        actions.push(action);
        currentTeam = action.preview;
      }
    }

    onComplete({
      content: fullContent,
      action: actions[0],
      actions: actions.length > 1 ? actions : undefined,
    });
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
