"use client";

import { useRef, useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { MemoizedMarkdown, tokenizeIncremental, type BlockCache } from "./MemoizedMarkdown";

export interface StreamingMarkdownHandle {
    pushDelta: (delta: string) => void;
    setContent: (content: string) => void;
    getContent: () => string;
}

const EMPTY_CACHE: BlockCache = { blocks: [], length: 0 };

/**
 * Schedule a single requestAnimationFrame flush. Multiple pushDelta calls
 * before the next paint are coalesced — only one rAF callback fires per frame.
 * The callback performs incremental tokenization and updates React state.
 */
function scheduleFlush(
    targetRef: React.RefObject<string>,
    cacheRef: React.RefObject<BlockCache>,
    rafRef: React.RefObject<boolean>,
    setResult: React.Dispatch<React.SetStateAction<{ blocks: string[]; cachedCount: number }>>,
    scrollRef: React.RefObject<HTMLDivElement | null>,
) {
    if (rafRef.current) return;
    rafRef.current = true;
    requestAnimationFrame(() => {
        rafRef.current = false;
        // Incremental tokenize — only re-parses the trailing incomplete block
        const result = tokenizeIncremental(targetRef.current, cacheRef.current);
        cacheRef.current = result.cache;
        setResult({ blocks: result.blocks, cachedCount: result.cachedCount });
        // Auto-scroll in the same frame
        const scroller = scrollRef.current?.closest("[data-chat-scroll]");
        if (scroller) {
            scroller.scrollTop = scroller.scrollHeight;
        }
    });
}

export const StreamingMarkdown = forwardRef<StreamingMarkdownHandle, { content?: string }>(
    function StreamingMarkdown({ content: initialContent }, ref) {
        const targetRef = useRef(initialContent ?? "");
        const cacheRef = useRef<BlockCache>(EMPTY_CACHE);
        const rafScheduledRef = useRef(false);
        const scrollRef = useRef<HTMLDivElement>(null);

        const [result, setResult] = useState<{ blocks: string[]; cachedCount: number }>({
            blocks: [],
            cachedCount: 0,
        });

        useImperativeHandle(
            ref,
            () => ({
                pushDelta(delta: string) {
                    targetRef.current += delta;
                    scheduleFlush(targetRef, cacheRef, rafScheduledRef, setResult, scrollRef);
                },
                setContent(text: string) {
                    targetRef.current = text;
                    cacheRef.current = EMPTY_CACHE;
                    scheduleFlush(targetRef, cacheRef, rafScheduledRef, setResult, scrollRef);
                },
                getContent() {
                    return targetRef.current;
                },
            }),
            [],
        );

        useEffect(() => {
            if (initialContent !== undefined) {
                targetRef.current = initialContent;
                cacheRef.current = EMPTY_CACHE;
            }
        }, [initialContent]);

        return (
            <div ref={scrollRef}>
                <MemoizedMarkdown
                    content=""
                    blocks={result.blocks}
                    cachedCount={result.cachedCount}
                    isStreaming
                />
            </div>
        );
    },
);
