"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { useChatStore } from "@/stores/chat-store";
import { useTeamStore } from "@/stores/team-store";
import { useHistoryStore } from "@/stores/history-store";
import { streamChatMessage } from "@/lib/ai";
import { Brain, Trash2 } from "lucide-react";
import type { TeamAction } from "@/types/chat";

export function ChatPanel() {
  const { messages, isLoading, addMessage, setLoading, setPendingAction, clearChat } =
    useChatStore();
  const { team, format, setPokemon, clearTeam } = useTeamStore();
  const { pushState } = useHistoryStore();
  const [isThinking, setIsThinking] = useState(false);

  // Apply multiple actions (for team generation)
  const applyActions = (actions: TeamAction[]) => {
    // Clear the team first if we're generating a full new team
    if (actions.length >= 3 && team.length === 0) {
      // Building from scratch
    }

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
  };

  const handleSend = async (content: string) => {
    // Add user message
    addMessage({ role: "user", content });

    // Add streaming message placeholder
    const streamingId = addMessage({
      role: "assistant",
      content: "",
      isLoading: true,
    });

    setLoading(true);
    setIsThinking(false);

    // Use streaming for Claude
    await streamChatMessage({
      message: content,
      team,
      format,
      provider: "claude",
      onChunk: (text) => {
        // Update message content as chunks arrive
        useChatStore.getState().updateMessage(streamingId, {
          content: text,
          isLoading: true,
        });
      },
      onThinking: (thinking) => {
        setIsThinking(thinking);
        if (thinking) {
          // Show thinking indicator in the message
          useChatStore.getState().updateMessage(streamingId, {
            content: "",
            isLoading: true,
          });
        }
      },
      onComplete: (response) => {
        setIsThinking(false);
        // Finalize the message
        useChatStore.getState().updateMessage(streamingId, {
          content: response.content,
          isLoading: false,
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
        setIsThinking(false);
        useChatStore.getState().updateMessage(streamingId, {
          content: `Error: ${error.message}`,
          isLoading: false,
        });
        setLoading(false);
      },
    });
  };

  return (
    <Card className="flex flex-col h-[600px] lg:h-[650px]">
      {/* Header with clear button */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium text-muted-foreground">AI Assistant</span>
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

      {/* Thinking indicator */}
      {isThinking && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b text-sm text-muted-foreground">
          <Brain className="h-4 w-4 animate-pulse text-primary" />
          <span>Analyzing your team...</span>
        </div>
      )}

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
    </Card>
  );
}
