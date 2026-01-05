"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types/chat";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ThinkingCollapsible } from "./ThinkingCollapsible";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3 py-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "flex-1 max-w-[80%] space-y-2",
          isUser ? "text-right" : "text-left"
        )}
      >
        {/* Thinking collapsible for assistant messages */}
        {!isUser && (message.thinkingContent || (message.isLoading && !message.content)) && (
          <ThinkingCollapsible
            content={message.thinkingContent || ""}
            isActive={message.isLoading === true && !message.content}
          />
        )}

        <div
          className={cn(
            "inline-block px-4 py-2 rounded-2xl",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted rounded-tl-sm"
          )}
        >
          {message.isLoading && !message.content ? (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          ) : message.content ? (
            <div className="text-sm [&_p]:my-1 [&_ul]:my-1 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:ml-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:bg-black/10 [&_code]:dark:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
