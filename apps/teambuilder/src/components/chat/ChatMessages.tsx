"use client";

import { memo, useEffect, useRef, useCallback, type RefObject } from "react";
import { useShallow } from "zustand/shallow";
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
    const scrollRAFRef = useRef<number>(undefined);
    const isUserScrolledUpRef = useRef(false);

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
        // Skip during active streaming — the rAF loop in StreamingMarkdown scrolls
        if (isLoading && messages.some((m) => m.isLoading && m.streamingPhase === "generating"))
            return;

        if (scrollRAFRef.current) {
            cancelAnimationFrame(scrollRAFRef.current);
        }
        scrollRAFRef.current = requestAnimationFrame(() => {
            const container = scrollContainerRef.current;
            if (container) {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: isLoading ? "instant" : "smooth",
                });
            }
        });
        return () => {
            if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
        };
    }, [messages, pendingAction, isLoading]);

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
            {messageIds.map((id, index) => (
                <ChatMessageWrapper
                    key={id}
                    messageId={id}
                    hasPendingAction={!!pendingAction}
                    streamingTextRef={
                        index === messageIds.length - 1 ? streamingTextRef : undefined
                    }
                />
            ))}

            {/* Show pending action card */}
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
