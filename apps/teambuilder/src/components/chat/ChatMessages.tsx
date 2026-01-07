"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { ChatMessage } from "./ChatMessage";
import { ActionCard } from "./ActionCard";

export function ChatMessages() {
  const { messages, pendingAction, isLoading } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  // Use instant scroll during streaming to avoid jank, smooth otherwise
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: isLoading ? "instant" : "smooth",
    });
  }, [messages, pendingAction, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">
            Ask me anything about your team!
          </p>
          <p className="text-sm text-muted-foreground">
            I can help with team building, coverage analysis, and competitive strategies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4">
      {messages.map((message) => (
        <div key={message.id}>
          <ChatMessage message={message} />
          {/* Show action card after the message that contains it */}
          {message.action && !pendingAction && (
            <div className="ml-11 mb-4">
              <ActionCard action={message.action} isApplied />
            </div>
          )}
        </div>
      ))}

      {/* Show pending action card */}
      {pendingAction && (
        <div className="ml-11 mb-4">
          <ActionCard action={pendingAction} />
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
