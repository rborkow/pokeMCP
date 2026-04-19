"use client";

import type { ChatClientState, UIMessage } from "@tanstack/ai-client";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import {
    type ResponseCardEntry,
    type SystemLogEntry as SystemLogEntryData,
    useChatStore,
} from "@/stores/chat-store";
import type { TeamAction } from "@/types/chat";
import { ActionCard } from "./ActionCard";
import { ChatMessage } from "./ChatMessage";
import { LiveAssistantMessage } from "./LiveAssistantMessage";
import type { LiveTextStreamHandle } from "./LiveTextStream";
import { ResponseDispatcher } from "./response/ResponseDispatcher";
import { SystemLogEntry } from "./SystemLogEntry";

export interface ActiveAssistantStream {
    isActive: boolean;
    messageId: string | null;
    createdAt: Date | null;
    hasText: boolean;
    initialTextContent: string;
    thinkingContent: string;
    isThinkingActive: boolean;
    pendingToolCalls: number;
    finishReason: string | null;
}

interface ChatMessagesProps {
    messages: UIMessage[];
    isLoading: boolean;
    status: ChatClientState;
    pendingAction: TeamAction | null;
    pendingActions: TeamAction[];
    advancePendingAction: () => void;
    activeStream: ActiveAssistantStream | null;
    streamingRef?: RefObject<LiveTextStreamHandle | null>;
}

/**
 * Wrapper for a single message — memoised on message identity.
 */
function ChatMessageWrapper({
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
}

export function ChatMessages({
    messages,
    isLoading,
    pendingAction,
    pendingActions,
    advancePendingAction,
    activeStream,
    streamingRef,
}: ChatMessagesProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isUserScrolledUpRef = useRef(false);
    const stickToBottomRef = useRef(true);

    const visibleMessages =
        activeStream?.isActive && isLoading && messages.at(-1)?.role === "assistant"
            ? messages.slice(0, -1)
            : messages;

    const systemLog = useChatStore((s) => s.systemLog);
    const responseCards = useChatStore((s) => s.responseCards);

    type TimelineItem =
        | { kind: "message"; id: string; createdAt: number; message: UIMessage }
        | { kind: "log"; id: string; createdAt: number; entry: SystemLogEntryData }
        | { kind: "card"; id: string; createdAt: number; entry: ResponseCardEntry };

    const timeline = useMemo<TimelineItem[]>(() => {
        const items: TimelineItem[] = [];
        for (const m of visibleMessages) {
            items.push({
                kind: "message",
                id: m.id,
                createdAt: m.createdAt?.getTime() ?? 0,
                message: m,
            });
        }
        for (const entry of systemLog) {
            items.push({ kind: "log", id: entry.id, createdAt: entry.createdAt, entry });
        }
        for (const entry of responseCards) {
            items.push({ kind: "card", id: entry.id, createdAt: entry.createdAt, entry });
        }
        items.sort((a, b) => a.createdAt - b.createdAt);
        return items;
    }, [visibleMessages, systemLog, responseCards]);

    const virtualizer = useVirtualizer({
        count: timeline.length,
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
        stickToBottomRef.current = !isUserScrolledUpRef.current;
    }, []);

    // Auto-scroll to bottom on new messages / pending actions
    // biome-ignore lint/correctness/useExhaustiveDependencies: pendingAction intentionally triggers scroll when actions appear
    useEffect(() => {
        if (isUserScrolledUpRef.current) return;
        if (timeline.length === 0) return;

        virtualizer.scrollToIndex(timeline.length - 1, {
            align: "end",
            behavior: isLoading ? "auto" : "smooth",
        });
    }, [timeline, pendingAction, isLoading, timeline.length, virtualizer]);

    if (timeline.length === 0 && !activeStream?.isActive) {
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
                    const item = timeline[virtualItem.index];
                    const isLast = virtualItem.index === timeline.length - 1;
                    return (
                        <div
                            key={item.id}
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
                            {item.kind === "message" ? (
                                <ChatMessageWrapper
                                    message={item.message}
                                    isStreaming={isLast && isLoading}
                                />
                            ) : item.kind === "log" ? (
                                <SystemLogEntry entry={item.entry} />
                            ) : (
                                <div className="py-2">
                                    <ResponseDispatcher card={item.entry.card} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {activeStream?.isActive && streamingRef && (
                <LiveAssistantMessage
                    createdAt={activeStream.createdAt}
                    hasText={activeStream.hasText}
                    initialTextContent={activeStream.initialTextContent}
                    thinkingContent={activeStream.thinkingContent}
                    isThinkingActive={activeStream.isThinkingActive}
                    streamRef={streamingRef}
                    stickToBottomRef={stickToBottomRef}
                />
            )}

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
