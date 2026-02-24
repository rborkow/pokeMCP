"use client";

import { useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { PersonalitySelector } from "./PersonalitySelector";
import { useChatStore } from "@/stores/chat-store";
import { useTeamStore } from "@/stores/team-store";
import { useHistoryStore } from "@/stores/history-store";
import { streamChatMessage } from "@/lib/ai";
import { Trash2 } from "lucide-react";
import type { TeamAction } from "@/types/chat";

function getErrorMessage(error: Error): string {
    const errorType = (error as Error & { errorType?: string }).errorType;
    switch (errorType) {
        case "rate_limit":
            return "You're sending messages too quickly. Please wait a moment and try again.";
        case "network":
            return "Network error — please check your connection and try again.";
        case "api":
            return "The AI service is temporarily unavailable. Please try again in a moment.";
        default:
            return `Error: ${error.message}`;
    }
}

export function ChatPanel() {
    const {
        messages,
        isLoading,
        addMessage,
        setLoading,
        setPendingAction,
        clearChat,
        personality: personalityId,
        enableThinking,
        queuedPrompt,
        clearQueuedPrompt,
        setLastUserPrompt,
    } = useChatStore();
    const { team, format, mode, setPokemon } = useTeamStore();
    const { pushState } = useHistoryStore();

    // Apply multiple actions (for team generation)
    const applyActions = useCallback(
        (actions: TeamAction[]) => {
            // Apply each action
            actions.forEach((action, index) => {
                if (action.payload?.pokemon) {
                    setPokemon(index, {
                        pokemon: action.payload.pokemon,
                        moves: action.payload.moves || [],
                        ability: action.payload.ability,
                        item: action.payload.item,
                        nature: action.payload.nature,
                        teraType: action.payload.teraType,
                        evs: action.payload.evs,
                        ivs: action.payload.ivs,
                    });
                }
            });

            // Save to history
            const lastAction = actions[actions.length - 1];
            if (lastAction?.preview) {
                pushState(lastAction.preview, `Generated ${actions.length} Pokemon team`);
            }
        },
        [setPokemon, pushState],
    );

    const handleSend = useCallback(
        async (content: string) => {
            // Save the user prompt for retry functionality
            setLastUserPrompt(content);

            // Get current messages before adding new ones (for chat history context)
            const currentMessages = useChatStore.getState().messages;

            // Add user message
            addMessage({ role: "user", content });

            // Add streaming message placeholder
            const streamingId = addMessage({
                role: "assistant",
                content: "",
                isLoading: true,
                streamingPhase: "connecting",
            });

            // Create abort controller and start stream
            const controller = useChatStore.getState().startStream();

            // Track accumulated content in closure to avoid stale store reads
            let accumulatedContent = "";

            // Use streaming for Claude
            await streamChatMessage({
                message: content,
                team,
                format,
                mode,
                personality: personalityId,
                enableThinking,
                chatHistory: currentMessages,
                signal: controller.signal,
                onChunk: (text) => {
                    // Throttled full-content update for markdown rendering
                    useChatStore.getState().updateMessage(streamingId, {
                        content: text,
                        isLoading: true,
                        buildingStatus: undefined,
                    });
                },
                onTextDelta: (delta) => {
                    // Delta-based accumulation (called on every token)
                    accumulatedContent += delta;
                    useChatStore.getState().updateMessage(streamingId, {
                        content: accumulatedContent,
                        isLoading: true,
                        streamingPhase: "generating",
                        buildingStatus: undefined,
                    });
                },
                onThinking: (_isThinking, thinkingText) => {
                    // Store thinking content in the message for inline display
                    if (thinkingText) {
                        useChatStore.getState().updateMessage(streamingId, {
                            thinkingContent: thinkingText,
                            streamingPhase: "thinking",
                        });
                    }
                },
                onToolUse: (pokemonName, count) => {
                    // Show building progress
                    useChatStore.getState().updateMessage(streamingId, {
                        buildingStatus: `Adding ${pokemonName}... (${count}/6)`,
                        isLoading: true,
                        streamingPhase: "tool_calling",
                    });
                },
                onPhaseChange: (phase) => {
                    useChatStore.getState().updateMessage(streamingId, {
                        streamingPhase: phase,
                    });
                },
                onComplete: (response) => {
                    // Finalize the message - include action so it persists
                    useChatStore.getState().updateMessage(streamingId, {
                        content: response.content,
                        isLoading: false,
                        streamingPhase: "complete",
                        action: response.action,
                    });

                    // Clear abort controller
                    useChatStore.getState().abortStream();
                    setLoading(false);

                    // If there are multiple actions (team generation), apply them all
                    if (response.actions && response.actions.length > 1) {
                        applyActions(response.actions);
                    } else if (response.action) {
                        // Single action - set as pending for user confirmation
                        setPendingAction(response.action);
                    }
                },
                onError: (error) => {
                    useChatStore.getState().updateMessage(streamingId, {
                        content: getErrorMessage(error),
                        isLoading: false,
                        streamingPhase: "error",
                    });
                    useChatStore.getState().abortStream();
                    setLoading(false);
                },
            });
        },
        [
            addMessage,
            setLoading,
            setLastUserPrompt,
            team,
            format,
            mode,
            personalityId,
            enableThinking,
            setPendingAction,
            applyActions,
        ],
    );

    const handleStop = useCallback(() => {
        useChatStore.getState().abortStream();
    }, []);

    // Watch for queued prompts from WelcomeOverlay
    useEffect(() => {
        if (queuedPrompt && !isLoading) {
            handleSend(queuedPrompt);
            clearQueuedPrompt();
        }
    }, [queuedPrompt, isLoading, handleSend, clearQueuedPrompt]);

    return (
        <div className="glass-panel flex flex-col h-[600px] lg:h-[650px]">
            {/* Header with personality selector and clear button */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
                <PersonalitySelector />
                {messages.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearChat}
                        disabled={isLoading}
                        className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Clear
                    </Button>
                )}
            </div>

            <SuggestedPrompts onSelect={handleSend} disabled={isLoading} />

            <ChatMessages />
            <ChatInput
                onSend={handleSend}
                onStop={handleStop}
                disabled={isLoading}
                isStreaming={isLoading}
                placeholder={
                    team.length === 0
                        ? "Import a team first, then ask me anything..."
                        : "Ask about your team..."
                }
            />
        </div>
    );
}
