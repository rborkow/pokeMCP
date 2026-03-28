"use client";

import { memo, useEffect, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { UIMessage } from "@tanstack/ai-client";
import type { ChatClientState } from "@tanstack/ai-client";
import { ChatMessage } from "./ChatMessage";
import { ActionCard } from "./ActionCard";
import type { TeamAction } from "@/types/chat";

interface ChatMessagesProps {
    messages: UIMessage[];
    isLoading: boolean;
    status: ChatClientState;
    pendingAction: TeamAction | null;
    pendingActions: TeamAction[];
    advancePendingAction: () => void;
}

/**
 * Wrapper for a single message — memoised on message identity.
 */
const ChatMessageWrapper = memo(function ChatMessageWrapper({
    message,
    isStreaming,
}: {
    message: UIMessage;
    isStreaming: boolean;
}) {
    return (
        <div>
            <ChatMessage message={message} isStreaming={isStreaming} />
        </div>
    );
});

export function ChatMessages({
    messages,
    isLoading,
    status: _status,
    pendingAction,
    pendingActions,
    advancePendingAction,
}: ChatMessagesProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isUserScrolledUpRef = useRef(false);

    const virtualizer = useVirtualizer({
        count: messages.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => 120,
        overscan: 3,
    });

    // Track if user has scrolled away from the bottom
    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;
        isUserScrolledUpRef.current = distanceFromBottom > 100;
    }, []);

    // Auto-scroll to bottom on new messages / pending actions
    // biome-ignore lint/correctness/useExhaustiveDependencies: pendingAction intentionally triggers scroll when actions appear
    useEffect(() => {
        if (isUserScrolledUpRef.current) return;
        if (messages.length === 0) return;

        virtualizer.scrollToIndex(messages.length - 1, {
            align: "end",
            behavior: isLoading ? "auto" : "smooth",
        });
    }, [messages, pendingAction, isLoading, messages.length, virtualizer]);

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center space-y-2">
                    <p className="text-muted-foreground">Ask me anything about your team!</p>
                    <p className="text-sm text-muted-foreground">
                        I can help with team building, coverage analysis, and competitive
                        strategies.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-3"
            onScroll={handleScroll}
            data-chat-scroll
        >
            <div
                style={{
                    height: virtualizer.getTotalSize(),
                    width: "100%",
                    position: "relative",
                }}
            >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const msg = messages[virtualItem.index];
                    const isLast = virtualItem.index === messages.length - 1;
                    return (
                        <div
                            key={msg.id}
                            data-index={virtualItem.index}
                            ref={virtualizer.measureElement}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                transform: `translateY(${virtualItem.start}px)`,
                            }}
                        >
                            <ChatMessageWrapper
                                message={msg}
                                isStreaming={isLast && isLoading && msg.role === "assistant"}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Show pending action card — rendered outside virtualizer */}
            {pendingAction && (
                <div className="mb-3">
                    {pendingActions.length > 0 && (
                        <p className="text-xs text-muted-foreground mb-1 px-1">
                            Change 1 of {pendingActions.length + 1}
                        </p>
                    )}
                    <ActionCard
                        action={pendingAction}
                        onApply={advancePendingAction}
                        onDismiss={advancePendingAction}
                    />
                </div>
            )}
        </div>
    );
}
