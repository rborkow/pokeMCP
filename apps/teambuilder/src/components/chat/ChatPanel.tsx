"use client";

import { Card } from "@/components/ui/card";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { useChatStore } from "@/stores/chat-store";
import { useTeamStore } from "@/stores/team-store";
import { sendChatMessage } from "@/lib/ai";

export function ChatPanel() {
  const { isLoading, addMessage, setLoading, setPendingAction, aiProvider } =
    useChatStore();
  const { team, format } = useTeamStore();

  const handleSend = async (content: string) => {
    // Add user message
    addMessage({ role: "user", content });

    // Add loading message
    const loadingId = addMessage({
      role: "assistant",
      content: "",
      isLoading: true,
    });

    setLoading(true);

    try {
      const response = await sendChatMessage({
        message: content,
        team,
        format,
        provider: aiProvider,
      });

      // Update the loading message with the response
      useChatStore.getState().updateMessage(loadingId, {
        content: response.content,
        isLoading: false,
      });

      // If there's an action, set it as pending
      if (response.action) {
        setPendingAction(response.action);
      }
    } catch (error) {
      // Update with error message
      useChatStore.getState().updateMessage(loadingId, {
        content:
          error instanceof Error
            ? `Error: ${error.message}`
            : "Sorry, something went wrong. Please try again.",
        isLoading: false,
      });
    } finally {
      setLoading(false);
    }
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
