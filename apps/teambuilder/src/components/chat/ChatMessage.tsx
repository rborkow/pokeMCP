"use client";

import { useMemo, type RefObject } from "react";
import type { UIMessage, MessagePart } from "@tanstack/ai-client";
import { Bot, User, Loader2 } from "lucide-react";
import { MemoizedMarkdown } from "./MemoizedMarkdown";
import { StreamingMarkdown, type StreamingMarkdownHandle } from "./StreamingMarkdown";
import { ThinkingCollapsible } from "./ThinkingCollapsible";

interface ChatMessageProps {
    message: UIMessage;
    /** Whether this message is actively being streamed */
    isStreaming: boolean;
    /** Imperative handle for pushing deltas directly during streaming */
    streamingRef?: RefObject<StreamingMarkdownHandle | null>;
}

/**
 * Extract all text content from a UIMessage's parts.
 */
function getTextContent(parts: MessagePart[]): string {
    return parts
        .filter((p): p is MessagePart & { type: "text" } => p.type === "text")
        .map((p) => p.content)
        .join("");
}

/**
 * Extract all thinking content from a UIMessage's parts.
 */
function getThinkingContent(parts: MessagePart[]): string {
    return parts
        .filter((p): p is MessagePart & { type: "thinking" } => p.type === "thinking")
        .map((p) => p.content)
        .join("\n");
}

/**
 * Check whether any tool-call parts exist.
 */
function hasToolCalls(parts: MessagePart[]): boolean {
    return parts.some((p) => p.type === "tool-call");
}

export function ChatMessage({ message, isStreaming, streamingRef }: ChatMessageProps) {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";

    const textContent = useMemo(() => getTextContent(message.parts), [message.parts]);
    const thinkingContent = useMemo(() => getThinkingContent(message.parts), [message.parts]);
    const hasTools = useMemo(() => hasToolCalls(message.parts), [message.parts]);

    const timestamp = message.createdAt;

    if (isSystem) {
        return (
            <div className="flex justify-center py-2">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {textContent}
                </span>
            </div>
        );
    }

    if (isUser) {
        return (
            <div className="flex gap-2 py-3 flex-row-reverse">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
                    <User className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 max-w-[85%] text-right space-y-1">
                    <div className="inline-block px-3 py-2 rounded-2xl bg-primary text-primary-foreground rounded-tr-sm">
                        <div className="text-sm">{textContent}</div>
                    </div>
                    {timestamp && (
                        <p className="text-xs text-muted-foreground">
                            {timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Determine if the thinking is currently active
    const isThinkingActive = isStreaming && !textContent && !hasTools;

    // Assistant message — full-width, no bubble
    return (
        <div className="py-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Bot className="h-3.5 w-3.5" />
                <span>Assistant</span>
                {timestamp && (
                    <span className="ml-auto">
                        {timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                )}
            </div>

            {/* Thinking content */}
            {(thinkingContent || isThinkingActive) && (
                <ThinkingCollapsible
                    content={thinkingContent}
                    isActive={isStreaming && (!textContent || thinkingContent.length > 0)}
                />
            )}

            {/* Text content */}
            {isStreaming && streamingRef ? (
                /* Streaming: deltas pushed via ref from onChunk — zero React re-renders */
                <StreamingMarkdown ref={streamingRef} />
            ) : isStreaming && textContent ? (
                /* Fallback: streaming without ref */
                <StreamingMarkdown content={textContent} />
            ) : textContent ? (
                <MemoizedMarkdown content={textContent} />
            ) : isStreaming && !thinkingContent && !hasTools ? (
                /* Loading indicator when streaming has started but no content yet */
                <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Connecting...</span>
                </div>
            ) : null}
        </div>
    );
}
