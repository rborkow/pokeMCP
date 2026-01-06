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

export function ChatPanel() {
  const {
    messages,
    isLoading,
    addMessage,
    setLoading,
    setPendingAction,
    clearChat,
    personality: personalityId,
    queuedPrompt,
    clearQueuedPrompt,
    setLastUserPrompt,
  } = useChatStore();
  const { team, format, setPokemon } = useTeamStore();
  const { pushState } = useHistoryStore();

  // Apply multiple actions (for team generation)
  const applyActions = useCallback((actions: TeamAction[]) => {
    // Apply each action
    actions.forEach((action, index) => {
      if (action.payload && action.payload.pokemon) {
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
  }, [setPokemon, pushState]);

  const handleSend = useCallback(async (content: string) => {
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
    });

    setLoading(true);

    // Use streaming for Claude
    await streamChatMessage({
      message: content,
      team,
      format,
      provider: "claude",
      personality: personalityId,
      chatHistory: currentMessages,
      onChunk: (text) => {
        // Update message content as chunks arrive
        useChatStore.getState().updateMessage(streamingId, {
          content: text,
          isLoading: true,
          buildingStatus: undefined, // Clear building status when text arrives
        });
      },
      onThinking: (_isThinking, thinkingText) => {
        // Store thinking content in the message for inline display
        if (thinkingText) {
          useChatStore.getState().updateMessage(streamingId, {
            thinkingContent: thinkingText,
          });
        }
      },
      onToolUse: (pokemonName, count) => {
        // Show building progress
        useChatStore.getState().updateMessage(streamingId, {
          buildingStatus: `Adding ${pokemonName}... (${count}/6)`,
          isLoading: true,
        });
      },
      onComplete: (response) => {
        // Finalize the message - include action so it persists
        useChatStore.getState().updateMessage(streamingId, {
          content: response.content,
          isLoading: false,
          action: response.action,
        });

        // If there are multiple actions (team generation), apply them all
        if (response.actions && response.actions.length > 1) {
          applyActions(response.actions);
        } else if (response.action) {
          // Single action - set as pending for user confirmation
          setPendingAction(response.action);
        }

        setLoading(false);
      },
      onError: (error) => {
        useChatStore.getState().updateMessage(streamingId, {
          content: `Error: ${error.message}`,
          isLoading: false,
        });
        setLoading(false);
      },
    });
  }, [addMessage, setLoading, setLastUserPrompt, team, format, personalityId, setPendingAction, applyActions]);

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
        disabled={isLoading}
        placeholder={
          team.length === 0
            ? "Import a team first, then ask me anything..."
            : "Ask about your team..."
        }
      />
    </div>
  );
}
