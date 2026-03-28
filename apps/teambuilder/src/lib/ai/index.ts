import type { TeamPokemon, Mode } from "@/types/pokemon";
import type { AIResponse, TeamAction, ChatMessage, StreamingPhase } from "@/types/chat";
import type { PersonalityId } from "./personalities";
import {
    type ValidationError,
    validateModifyTeamInput,
    validatePokemonData,
} from "@/lib/validation/pokemon";
import type { ModifyTeamInput } from "./tools";

/**
 * Parse a tool input into a TeamAction
 */
export function parseToolToAction(
    toolInput: ModifyTeamInput,
    team: TeamPokemon[],
    slotOffset = 0,
): TeamAction | undefined {
    try {
        // Build the preview team
        const preview = [...team];
        const slot = toolInput.slot ?? team.length + slotOffset;

        // Snapshot the current Pokemon at this slot before applying the action
        const previousState: Partial<TeamPokemon> | undefined = team[slot]
            ? { ...team[slot] }
            : undefined;

        if (toolInput.action_type === "remove_pokemon") {
            preview.splice(slot, 1);
        } else if (
            toolInput.action_type === "add_pokemon" ||
            toolInput.action_type === "replace_pokemon"
        ) {
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
            if (toolInput.moves !== undefined && toolInput.moves.length > 0)
                updates.moves = toolInput.moves;
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
        let validationErrors: ValidationError[] | undefined;
        if (toolInput.action_type !== "remove_pokemon") {
            const validation = validatePokemonData(payload);
            if (!validation.valid) {
                validationErrors = validation.errors;
            }
        }

        // Map action type — for update_pokemon, infer specific type from fields
        let actionType: TeamAction["type"];
        if (toolInput.action_type === "update_pokemon") {
            if (
                toolInput.move_slot !== undefined &&
                toolInput.moves &&
                toolInput.moves.length > 0
            ) {
                actionType = "update_move";
                // Propagate move_slot into payload for ActionCard display
                (payload as Record<string, unknown>).moveSlot = toolInput.move_slot;
            } else if (toolInput.moves && toolInput.moves.length > 0) {
                actionType = "update_moveset";
            } else if (
                toolInput.item &&
                !toolInput.ability &&
                !toolInput.nature &&
                !toolInput.evs &&
                !toolInput.tera_type
            ) {
                actionType = "update_item";
            } else if (
                toolInput.ability &&
                !toolInput.item &&
                !toolInput.nature &&
                !toolInput.evs &&
                !toolInput.tera_type
            ) {
                actionType = "update_ability";
            } else if (
                toolInput.nature &&
                !toolInput.item &&
                !toolInput.ability &&
                !toolInput.evs &&
                !toolInput.tera_type
            ) {
                actionType = "update_nature";
            } else if (
                toolInput.evs &&
                !toolInput.item &&
                !toolInput.ability &&
                !toolInput.nature &&
                !toolInput.tera_type
            ) {
                actionType = "update_evs";
            } else if (
                toolInput.tera_type &&
                !toolInput.item &&
                !toolInput.ability &&
                !toolInput.nature &&
                !toolInput.evs
            ) {
                actionType = "update_tera_type";
            } else {
                actionType = "update_moveset"; // Fallback for multi-field updates
            }
        } else {
            const typeMap: Record<string, TeamAction["type"]> = {
                add_pokemon: "add_pokemon",
                replace_pokemon: "replace_pokemon",
                remove_pokemon: "remove_pokemon",
            };
            actionType = typeMap[toolInput.action_type] || "add_pokemon";
        }

        return {
            type: actionType,
            slot: slot,
            payload: payload,
            preview: preview.filter(Boolean),
            reason: toolInput.reason || "AI suggestion",
            validationErrors,
            previousState,
        };
    } catch (e) {
        console.error("Failed to parse tool to action:", e);
        return undefined;
    }
}

/**
 * Convert ChatMessage array to simplified format for API
 */
function formatChatHistory(
    messages: ChatMessage[],
): { role: "user" | "assistant"; content: string }[] {
    return messages
        .filter((msg) => msg.role !== "system" && !msg.isLoading && msg.content.trim())
        .map((msg) => ({
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
    enableThinking?: boolean;
    chatHistory?: ChatMessage[];
    signal?: AbortSignal;
    onChunk: (text: string) => void;
    onTextDelta?: (delta: string) => void;
    onThinking?: (isThinking: boolean, thinkingText?: string) => void;
    onToolUse?: (pokemonName: string, toolCount: number) => void;
    onPhaseChange?: (phase: StreamingPhase) => void;
    onComplete: (response: AIResponse) => void;
    onError: (error: Error) => void;
}

/**
 * Send a chat message to Claude with streaming response.
 *
 * The server returns AG-UI protocol events via TanStack AI's
 * toServerSentEventsResponse(). This function parses them into
 * the same callback interface used by the rest of the chat UI.
 */
export async function streamChatMessage({
    message,
    team,
    format,
    mode = "singles",
    personality,
    enableThinking,
    chatHistory = [],
    signal,
    onChunk,
    onTextDelta,
    onThinking,
    onToolUse,
    onPhaseChange,
    onComplete,
    onError,
}: StreamChatMessageOptions): Promise<void> {
    try {
        onPhaseChange?.("connecting");

        const response = await fetch("/api/ai/claude/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                team,
                format,
                mode,
                personality,
                enableThinking,
                chatHistory: formatChatHistory(chatHistory),
            }),
            signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(errorText || `AI request failed: ${response.status}`);
            if (response.status === 429) {
                (error as Error & { errorType?: string }).errorType = "rate_limit";
            } else if (response.status >= 500) {
                (error as Error & { errorType?: string }).errorType = "api";
            }
            throw error;
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let fullContent = "";
        let thinkingContent = "";
        let isCurrentlyThinking = false;
        let buffer = "";
        const toolCalls: ModifyTeamInput[] = [];
        // Map of toolCallId -> accumulated JSON args string
        const toolArgsMap = new Map<string, string>();
        const toolNameMap = new Map<string, string>();

        // Throttle onChunk to reduce markdown re-renders
        let lastChunkTime = 0;
        const CHUNK_THROTTLE_MS = 80;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE events (they end with \n\n)
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";

            for (const event of events) {
                const lines = event.split("\n");
                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const data = line.slice(6);
                    if (!data || data === "[DONE]") continue;

                    try {
                        const parsed = JSON.parse(data);
                        const eventType = parsed.type as string;

                        switch (eventType) {
                            case "RUN_STARTED":
                                onPhaseChange?.("generating");
                                break;

                            case "TEXT_MESSAGE_START":
                                if (!isCurrentlyThinking) {
                                    onPhaseChange?.("generating");
                                }
                                break;

                            case "TEXT_MESSAGE_CONTENT": {
                                const delta = parsed.delta as string;
                                if (delta) {
                                    fullContent += delta;
                                    onTextDelta?.(delta);

                                    const now = Date.now();
                                    if (now - lastChunkTime > CHUNK_THROTTLE_MS) {
                                        onChunk(fullContent);
                                        lastChunkTime = now;
                                    }
                                }
                                break;
                            }

                            case "STEP_STARTED":
                                if (parsed.stepType === "thinking") {
                                    isCurrentlyThinking = true;
                                    thinkingContent = "";
                                    onPhaseChange?.("thinking");
                                    onThinking?.(true, "");
                                }
                                break;

                            case "STEP_FINISHED":
                                if (parsed.delta) {
                                    // Thinking content delta
                                    thinkingContent = parsed.content || thinkingContent + parsed.delta;
                                    onThinking?.(true, thinkingContent);
                                } else if (isCurrentlyThinking) {
                                    // Thinking phase complete (no delta = final event)
                                    isCurrentlyThinking = false;
                                    onThinking?.(false, thinkingContent);
                                }
                                break;

                            case "TOOL_CALL_START": {
                                onPhaseChange?.("tool_calling");
                                const toolCallId = parsed.toolCallId as string;
                                const toolName = parsed.toolName as string;
                                toolArgsMap.set(toolCallId, "");
                                toolNameMap.set(toolCallId, toolName);
                                break;
                            }

                            case "TOOL_CALL_ARGS": {
                                const callId = parsed.toolCallId as string;
                                const argDelta = parsed.delta as string;
                                const existing = toolArgsMap.get(callId) || "";
                                toolArgsMap.set(callId, existing + argDelta);
                                break;
                            }

                            case "TOOL_CALL_END": {
                                const endId = parsed.toolCallId as string;
                                const name = toolNameMap.get(endId) || parsed.toolName;
                                // Use parsed.input if provided, otherwise parse accumulated args
                                let input = parsed.input;
                                if (!input) {
                                    const argsStr = toolArgsMap.get(endId);
                                    if (argsStr) {
                                        try {
                                            input = JSON.parse(argsStr);
                                        } catch {
                                            // skip malformed args
                                        }
                                    }
                                }

                                if (name === "modify_team" && input) {
                                    const validation = validateModifyTeamInput(input);
                                    if (!validation.valid) {
                                        console.warn(
                                            "[AI] Invalid tool input from Claude:",
                                            validation.errors,
                                        );
                                        break;
                                    }
                                    toolCalls.push(input as ModifyTeamInput);
                                    onToolUse?.(
                                        (input as ModifyTeamInput).pokemon || "Pokemon",
                                        toolCalls.length,
                                    );
                                }
                                break;
                            }

                            case "RUN_FINISHED": {
                                // Ensure final content is flushed
                                onChunk(fullContent);

                                // Convert tool calls to TeamActions
                                const actions: TeamAction[] = [];
                                let currentTeam = [...team];
                                for (const toolInput of toolCalls) {
                                    const action = parseToolToAction(
                                        toolInput,
                                        currentTeam,
                                        actions.length,
                                    );
                                    if (action) {
                                        actions.push(action);
                                        currentTeam = action.preview;
                                    }
                                }

                                onPhaseChange?.("complete");
                                onComplete({
                                    content: fullContent,
                                    action: actions[0],
                                    actions: actions.length > 1 ? actions : undefined,
                                });
                                return;
                            }

                            case "RUN_ERROR": {
                                const errorMsg =
                                    parsed.error?.message || "Unknown streaming error";
                                const error = new Error(errorMsg);
                                (error as Error & { errorType?: string }).errorType = "api";
                                throw error;
                            }
                        }
                    } catch (parseErr) {
                        if (
                            parseErr instanceof Error &&
                            (parseErr as Error & { errorType?: string }).errorType
                        ) {
                            throw parseErr;
                        }
                        // Skip invalid JSON lines
                    }
                }
            }
        }

        // If we get here without RUN_FINISHED, still complete
        onChunk(fullContent);

        const actions: TeamAction[] = [];
        let currentTeam = [...team];
        for (const toolInput of toolCalls) {
            const action = parseToolToAction(toolInput, currentTeam, actions.length);
            if (action) {
                actions.push(action);
                currentTeam = action.preview;
            }
        }

        onPhaseChange?.("complete");
        onComplete({
            content: fullContent,
            action: actions[0],
            actions: actions.length > 1 ? actions : undefined,
        });
    } catch (error) {
        // Handle abort/cancellation gracefully
        if (error instanceof DOMException && error.name === "AbortError") {
            onPhaseChange?.("cancelled");
            return;
        }

        onPhaseChange?.("error");
        onError(error instanceof Error ? error : new Error(String(error)));
    }
}
