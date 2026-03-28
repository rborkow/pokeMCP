"use client";

import { memo, useEffect, useRef, useCallback, type RefObject } from "react";
import { useShallow } from "zustand/shallow";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useChatStore } from "@/stores/chat-store";
import { ChatMessage } from "./ChatMessage";
import { ActionCard } from "./ActionCard";
import type { ChatMessage as ChatMessageType } from "@/types/chat";
import type { StreamingMarkdownHandle } from "./StreamingMarkdown";

/**
 * Wrapper that subscribes to a single message by ID.
 * Only re-renders when *this* message changes — not when siblings update.
 */
const ChatMessageWrapper = memo(function ChatMessageWrapper({
    messageId,
    hasPendingAction,
    streamingTextRef,
}: {
    messageId: string;
    hasPendingAction: boolean;
    streamingTextRef?: RefObject<StreamingMarkdownHandle | null>;
}) {
    const message = useChatStore(
        useCallback(
            (s: { messages: ChatMessageType[] }) => s.messages.find((m) => m.id === messageId),
            [messageId],
        ),
    );

    if (!message) return null;

    return (
        <div>
            <ChatMessage
                message={message}
                streamingTextRef={
                    message.isLoading && message.streamingPhase !== "error"
                        ? streamingTextRef
                        : undefined
                }
            />
            {message.action && !hasPendingAction && (
                <div className="mb-3">
                    <ActionCard action={message.action} isApplied />
                </div>
            )}
        </div>
    );
});

export function ChatMessages({
    streamingTextRef,
}: {
    streamingTextRef?: RefObject<StreamingMarkdownHandle | null>;
}) {
    const messageIds = useChatStore(useShallow((s) => s.messages.map((m) => m.id)));
    const pendingAction = useChatStore((s) => s.pendingAction);
    const pendingActions = useChatStore((s) => s.pendingActions);
    const isLoading = useChatStore((s) => s.isLoading);
    const messages = useChatStore((s) => s.messages);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isUserScrolledUpRef = useRef(false);

    const virtualizer = useVirtualizer({
        count: messageIds.length,
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

    // Auto-scroll to bottom on new messages / pending actions (not during
    // active streaming — StreamingMarkdown handles that via data-chat-scroll)
    // biome-ignore lint/correctness/useExhaustiveDependencies: pendingAction intentionally triggers scroll when actions appear
    useEffect(() => {
        if (isUserScrolledUpRef.current) return;
        if (messageIds.length === 0) return;
        // Skip during active streaming — the rAF loop in StreamingMarkdown scrolls
        if (isLoading && messages.some((m) => m.isLoading && m.streamingPhase === "generating"))
            return;

        virtualizer.scrollToIndex(messageIds.length - 1, {
            align: "end",
            behavior: isLoading ? "auto" : "smooth",
        });
    }, [messages, pendingAction, isLoading, messageIds.length, virtualizer]);

    if (messageIds.length === 0) {
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
                {virtualizer.getVirtualItems().map((virtualItem) => (
                    <div
                        key={messageIds[virtualItem.index]}
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
                            messageId={messageIds[virtualItem.index]}
                            hasPendingAction={!!pendingAction}
                            streamingTextRef={
                                virtualItem.index === messageIds.length - 1
                                    ? streamingTextRef
                                    : undefined
                            }
                        />
                    </div>
                ))}
            </div>

            {/* Show pending action card — rendered outside virtualizer */}
            {pendingAction && (
                <div className="mb-3">
                    {pendingActions.length > 0 && (
                        <p className="text-xs text-muted-foreground mb-1 px-1">
                            Change 1 of {pendingActions.length + 1}
                        </p>
                    )}
                    <ActionCard action={pendingAction} />
                </div>
            )}
        </div>
    );
}
