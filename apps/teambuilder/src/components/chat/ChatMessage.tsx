"use client";

import { memo, useMemo } from "react";
import type { ChatMessage as ChatMessageType, StreamingPhase } from "@/types/chat";
import { Bot, User, Loader2, Wrench } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThinkingCollapsible } from "./ThinkingCollapsible";
import { StreamingText } from "./StreamingText";

interface ChatMessageProps {
    message: ChatMessageType;
}

function StreamingIndicator({
    phase,
    buildingStatus,
}: {
    phase?: StreamingPhase;
    buildingStatus?: string;
}) {
    switch (phase) {
        case "connecting":
            return (
                <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Connecting...</span>
                </div>
            );
        case "thinking":
            // ThinkingCollapsible handles this display
            return null;
        case "tool_calling":
            return (
                <div className="flex items-center gap-2">
                    <Wrench className="h-3.5 w-3.5 animate-pulse text-primary" />
                    <span className="text-sm text-muted-foreground">
                        {buildingStatus || "Modifying team..."}
                    </span>
                </div>
            );
        default:
            // "generating" or fallback — bouncing dots
            return (
                <div className="flex items-center gap-1">
                    <span
                        className="w-2 h-2 bg-current rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                    />
                    <span
                        className="w-2 h-2 bg-current rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                    />
                    <span
                        className="w-2 h-2 bg-current rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                    />
                </div>
            );
    }
}

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";

    const renderedContent = useMemo(
        () =>
            message.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            ) : null,
        [message.content],
    );

    if (isSystem) {
        return (
            <div className="flex justify-center py-2">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {message.content}
                </span>
            </div>
        );
    }

    // Determine if thinking collapsible should show as active
    const isThinkingActive =
        message.isLoading === true &&
        !message.content &&
        (message.streamingPhase === "thinking" || !message.streamingPhase);

    if (isUser) {
        return (
            <div className="flex gap-2 py-3 flex-row-reverse">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
                    <User className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 max-w-[85%] text-right space-y-1">
                    <div className="inline-block px-3 py-2 rounded-2xl bg-primary text-primary-foreground rounded-tr-sm">
                        <div className="text-sm">{message.content}</div>
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

    // Assistant message — full-width, no bubble, maximize content space
    return (
        <div className="py-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Bot className="h-3.5 w-3.5" />
                <span>Assistant</span>
                <span className="ml-auto">
                    {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </span>
            </div>

            {(message.thinkingContent || isThinkingActive) && (
                <ThinkingCollapsible
                    content={message.thinkingContent || ""}
                    isActive={
                        isThinkingActive ||
                        (message.isLoading === true && message.streamingPhase === "thinking")
                    }
                />
            )}

            {message.isLoading && !message.content ? (
                <StreamingIndicator
                    phase={message.streamingPhase}
                    buildingStatus={message.buildingStatus}
                />
            ) : message.isLoading && message.content ? (
                <StreamingText content={message.content} />
            ) : message.content ? (
                <div className="chat-markdown text-sm">{renderedContent}</div>
            ) : null}
        </div>
    );
});
