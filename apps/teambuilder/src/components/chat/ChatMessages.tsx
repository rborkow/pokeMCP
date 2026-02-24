"use client";

import { useEffect, useRef, useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import { ChatMessage } from "./ChatMessage";
import { ActionCard } from "./ActionCard";

export function ChatMessages() {
    const { messages, pendingAction, isLoading } = useChatStore();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollRAFRef = useRef<number>(undefined);
    const isUserScrolledUpRef = useRef(false);

    // Track if user has scrolled away from the bottom
    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;
        // Consider "near bottom" if within 100px
        isUserScrolledUpRef.current = distanceFromBottom > 100;
    }, []);

    // Auto-scroll to bottom, debounced with RAF
    // Only auto-scroll if user hasn't scrolled up
    useEffect(() => {
        if (isUserScrolledUpRef.current && isLoading) return;

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
        >
            {messages.map((message) => (
                <div key={message.id}>
                    <ChatMessage message={message} />
                    {/* Show action card after the message that contains it */}
                    {message.action && !pendingAction && (
                        <div className="mb-3">
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
        </div>
    );
}
