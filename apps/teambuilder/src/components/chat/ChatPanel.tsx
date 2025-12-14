"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { useChatStore } from "@/stores/chat-store";
import { useTeamStore } from "@/stores/team-store";
import { streamChatMessage } from "@/lib/ai";
import { Brain } from "lucide-react";

export function ChatPanel() {
  const { isLoading, addMessage, setLoading, setPendingAction } =
    useChatStore();
  const { team, format } = useTeamStore();
  const [isThinking, setIsThinking] = useState(false);

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

        // If there's an action, set it as pending
        if (response.action) {
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
    <Card className="flex flex-col h-[500px]">
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
