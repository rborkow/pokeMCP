"use client";

import { useRef, useEffect, useImperativeHandle, useState, forwardRef, useCallback } from "react";
import { MemoizedMarkdown } from "./MemoizedMarkdown";

export interface StreamingMarkdownHandle {
    pushDelta: (delta: string) => void;
    setContent: (content: string) => void;
    getContent: () => string;
}

const RENDER_INTERVAL_MS = 50;

export const StreamingMarkdown = forwardRef<StreamingMarkdownHandle, { content?: string }>(
    function StreamingMarkdown({ content: initialContent }, ref) {
        const targetRef = useRef(initialContent ?? "");
        const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
        const [rendered, setRendered] = useState(initialContent ?? "");
        const scrollRef = useRef<HTMLDivElement>(null);

        const startTimer = useCallback(() => {
            if (timerRef.current) return;
            timerRef.current = setInterval(() => {
                const current = targetRef.current;
                setRendered((prev) => {
                    if (prev === current) {
                        clearInterval(timerRef.current);
                        timerRef.current = undefined;
                        return prev;
                    }
                    return current;
                });
                const scroller = scrollRef.current?.closest("[data-chat-scroll]");
                if (scroller) {
                    scroller.scrollTop = scroller.scrollHeight;
                }
            }, RENDER_INTERVAL_MS);
        }, []);

        useImperativeHandle(
            ref,
            () => ({
                pushDelta(delta: string) {
                    targetRef.current += delta;
                    startTimer();
                },
                setContent(text: string) {
                    targetRef.current = text;
                    startTimer();
                },
                getContent() {
                    return targetRef.current;
                },
            }),
            [startTimer],
        );

        // Sync target ref when prop changes — rendered state is initialized
        // from the prop via useState(initialContent) so no setState needed here.
        useEffect(() => {
            if (initialContent !== undefined) {
                targetRef.current = initialContent;
            }
        }, [initialContent]);

        useEffect(() => {
            return () => {
                if (timerRef.current) clearInterval(timerRef.current);
            };
        }, []);

        return (
            <div ref={scrollRef}>
                <MemoizedMarkdown content={rendered} />
            </div>
        );
    },
);
