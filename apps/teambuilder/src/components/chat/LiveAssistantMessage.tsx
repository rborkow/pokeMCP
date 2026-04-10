"use client";

import { type RefObject } from "react";
import { Bot, Loader2 } from "lucide-react";
import { LiveTextStream, type LiveTextStreamHandle } from "./LiveTextStream";
import { ThinkingCollapsible } from "./ThinkingCollapsible";

interface LiveAssistantMessageProps {
    createdAt?: Date | null;
    hasText: boolean;
    initialTextContent: string;
    thinkingContent: string;
    isThinkingActive: boolean;
    streamRef: RefObject<LiveTextStreamHandle | null>;
    stickToBottomRef?: RefObject<boolean>;
}

export function LiveAssistantMessage({
    createdAt,
    hasText,
    initialTextContent,
    thinkingContent,
    isThinkingActive,
    streamRef,
    stickToBottomRef,
}: LiveAssistantMessageProps) {
    return (
        <div className="py-3 space-y-1" data-testid="live-assistant-message">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Bot className="h-3.5 w-3.5" />
                <span>Assistant</span>
                {createdAt && (
                    <span className="ml-auto">
                        {createdAt.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                )}
            </div>

            {(thinkingContent || isThinkingActive) && (
                <ThinkingCollapsible content={thinkingContent} isActive={isThinkingActive} />
            )}

            {hasText ? (
                <LiveTextStream
                    ref={streamRef}
                    content={initialTextContent}
                    stickToBottomRef={stickToBottomRef}
                />
            ) : !thinkingContent && !isThinkingActive ? (
                <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Connecting...</span>
                </div>
            ) : null}
        </div>
    );
}
