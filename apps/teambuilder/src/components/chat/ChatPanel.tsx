"use client";

import { Card } from "@/components/ui/card";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { useChatStore } from "@/stores/chat-store";
import { useTeamStore } from "@/stores/team-store";
import { streamChatMessage } from "@/lib/ai";

export function ChatPanel() {
  const { isLoading, addMessage, setLoading, setPendingAction } =
    useChatStore();
  const { team, format } = useTeamStore();

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
      onComplete: (response) => {
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
