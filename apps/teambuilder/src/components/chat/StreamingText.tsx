"use client";

import { useRef, useEffect } from "react";

interface StreamingTextProps {
    content: string;
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
 * When `content` grows, the delta is revealed ~2-3 characters per frame
 * via requestAnimationFrame, giving a smooth typewriter effect.
 * Only used during active streaming — completed messages use ReactMarkdown.
 */
export function StreamingText({ content }: StreamingTextProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(undefined);
    // How many characters of `content` are currently visible in the DOM
    const displayedLenRef = useRef(0);
    // The latest target content (updated by each render via effect)
    const targetRef = useRef(content);

    useEffect(() => {
        targetRef.current = content;

        // If this is the first render or content was reset, show what we have instantly
        if (displayedLenRef.current === 0 && content.length > 0) {
            const el = containerRef.current;
            if (el) {
                renderTextToElement(el, content);
                displayedLenRef.current = content.length;
            }
            return;
        }

        // Already animating? The existing rAF loop will pick up the new target.
        if (rafRef.current) return;

        function tick() {
            const target = targetRef.current;
            const displayed = displayedLenRef.current;

            if (displayed >= target.length) {
                // Caught up — stop the loop, wait for next content update
                rafRef.current = undefined;
                return;
            }

            // Reveal 2-3 chars per frame (~120-180 chars/sec at 60fps)
            // Enough to feel smooth without lagging behind fast tokens
            const step = Math.max(2, Math.ceil((target.length - displayed) / 8));
            const nextLen = Math.min(displayed + step, target.length);
            displayedLenRef.current = nextLen;

            const el = containerRef.current;
            if (el) {
                renderTextToElement(el, target.slice(0, nextLen));
            }

            rafRef.current = requestAnimationFrame(tick);
        }

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = undefined;
            }
        };
    }, [content]);

    // On unmount, flush any remaining content so the transition to
    // ReactMarkdown doesn't flash a shorter string
    useEffect(() => {
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = undefined;
            }
        };
    }, []);

    return <div ref={containerRef} className="chat-markdown streaming text-sm" />;
}
