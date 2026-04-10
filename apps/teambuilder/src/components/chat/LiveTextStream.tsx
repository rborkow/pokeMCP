"use client";

import { useImperativeHandle, useRef, useState, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface LiveTextStreamHandle {
    pushDelta: (delta: string) => void;
    setContent: (content: string) => void;
    clear: () => void;
    getContent: () => string;
}

function scheduleFlush(
    targetRef: React.RefObject<string>,
    rafRef: React.RefObject<boolean>,
    setRendered: React.Dispatch<React.SetStateAction<string>>,
    scrollRef: React.RefObject<HTMLDivElement | null>,
    stickToBottomRef?: React.RefObject<boolean>,
) {
    if (rafRef.current) return;
    rafRef.current = true;
    requestAnimationFrame(() => {
        rafRef.current = false;
        setRendered(targetRef.current);

        if (stickToBottomRef && !stickToBottomRef.current) {
            return;
        }

        const scroller = scrollRef.current?.closest("[data-chat-scroll]");
        if (scroller) {
            scroller.scrollTop = scroller.scrollHeight;
        }
    });
}

interface LiveTextStreamProps {
    content?: string;
    stickToBottomRef?: React.RefObject<boolean>;
}

export const LiveTextStream = forwardRef<LiveTextStreamHandle, LiveTextStreamProps>(
    function LiveTextStream({ content: initialContent, stickToBottomRef }, ref) {
        const targetRef = useRef(initialContent ?? "");
        const rafScheduledRef = useRef(false);
        const scrollRef = useRef<HTMLDivElement>(null);
        const [rendered, setRendered] = useState(initialContent ?? "");

        useImperativeHandle(
            ref,
            () => ({
                pushDelta(delta: string) {
                    targetRef.current += delta;
                    scheduleFlush(
                        targetRef,
                        rafScheduledRef,
                        setRendered,
                        scrollRef,
                        stickToBottomRef,
                    );
                },
                setContent(text: string) {
                    targetRef.current = text;
                    scheduleFlush(
                        targetRef,
                        rafScheduledRef,
                        setRendered,
                        scrollRef,
                        stickToBottomRef,
                    );
                },
                clear() {
                    targetRef.current = "";
                    setRendered("");
                },
                getContent() {
                    return targetRef.current;
                },
            }),
            [stickToBottomRef],
        );

        return (
            <div
                ref={scrollRef}
                className={cn(
                    "chat-markdown streaming text-sm whitespace-pre-wrap break-words",
                    !rendered && "min-h-0",
                )}
            >
                {rendered}
            </div>
        );
    },
);
