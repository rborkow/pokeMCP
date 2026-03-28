"use client";

import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";

/**
 * Handle exposed by StreamingText for pushing content without React re-renders.
 */
export interface StreamingTextHandle {
    /** Append a delta to the target content. The rAF loop reveals it smoothly. */
    pushDelta: (delta: string) => void;
    /** Replace the full target content (used for initial/reset). */
    setContent: (content: string) => void;
    /** Return the full accumulated content so far. */
    getContent: () => string;
}

/**
 * Renders plain text into a container element using safe DOM manipulation.
 * Handles newlines as <br> and **bold** as <strong>.
 */
function renderTextToElement(el: HTMLElement, text: string) {
    const fragment = document.createDocumentFragment();
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
            fragment.appendChild(document.createElement("br"));
        }
        const parts = lines[i].split(/(\*\*.+?\*\*)/g);
        for (const part of parts) {
            if (part.startsWith("**") && part.endsWith("**")) {
                const strong = document.createElement("strong");
                strong.textContent = part.slice(2, -2);
                fragment.appendChild(strong);
            } else {
                fragment.appendChild(document.createTextNode(part));
            }
        }
    }
    el.textContent = "";
    el.appendChild(fragment);
}

/**
 * Lightweight streaming text renderer that animates new characters in
 * progressively rather than stamping entire chunks at once.
 *
 * Accepts an imperative handle (ref) so the parent can push deltas
 * directly, avoiding React re-renders during active streaming.
 * A built-in rAF loop reveals ~2-3 characters per frame for a smooth
 * typewriter effect and auto-scrolls the nearest scrollable ancestor.
 */
export const StreamingText = forwardRef<StreamingTextHandle, { content?: string }>(
    function StreamingText({ content }, ref) {
        const containerRef = useRef<HTMLDivElement>(null);
        const rafRef = useRef<number>(undefined);
        const displayedLenRef = useRef(0);
        const targetRef = useRef(content ?? "");

        // Stable function refs — these never change identity, satisfying the
        // exhaustive-deps lint without introducing circular declaration issues.
        const tickRef = useRef<() => void>(null!);
        const ensureLoopRef = useRef<() => void>(null!);

        tickRef.current = () => {
            const target = targetRef.current;
            const displayed = displayedLenRef.current;

            if (displayed >= target.length) {
                rafRef.current = undefined;
                return;
            }

            // Reveal characters: adaptive step — faster when far behind, slower when close
            const remaining = target.length - displayed;
            const step = Math.max(2, Math.ceil(remaining / 8));
            const nextLen = Math.min(displayed + step, target.length);
            displayedLenRef.current = nextLen;

            const el = containerRef.current;
            if (el) {
                renderTextToElement(el, target.slice(0, nextLen));

                // Auto-scroll within the same frame to avoid layout shift
                const scroller = el.closest("[data-chat-scroll]");
                if (scroller) {
                    scroller.scrollTop = scroller.scrollHeight;
                }
            }

            rafRef.current = requestAnimationFrame(() => tickRef.current());
        };

        ensureLoopRef.current = () => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(() => tickRef.current());
        };

        // Expose imperative handle for zero-re-render streaming
        useImperativeHandle(
            ref,
            () => ({
                pushDelta(delta: string) {
                    targetRef.current += delta;
                    ensureLoopRef.current();
                },
                setContent(text: string) {
                    targetRef.current = text;
                    ensureLoopRef.current();
                },
                getContent() {
                    return targetRef.current;
                },
            }),
            [],
        );

        // Sync from prop when content is provided (initial render / fallback)
        useEffect(() => {
            if (content === undefined) return;
            targetRef.current = content;

            if (displayedLenRef.current === 0 && content.length > 0) {
                const el = containerRef.current;
                if (el) {
                    renderTextToElement(el, content);
                    displayedLenRef.current = content.length;
                }
                return;
            }

            ensureLoopRef.current();

            return () => {
                if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = undefined;
                }
            };
        }, [content]);

        // Cleanup on unmount
        useEffect(() => {
            return () => {
                if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = undefined;
                }
            };
        }, []);

        return <div ref={containerRef} className="chat-markdown streaming text-sm" />;
    },
);
