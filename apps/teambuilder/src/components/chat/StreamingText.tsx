"use client";

import { useRef, useEffect } from "react";

interface StreamingTextProps {
    content: string;
}

/**
 * Lightweight streaming text renderer that bypasses React virtual DOM diffing.
 * Builds DOM nodes directly via ref + requestAnimationFrame for smooth token rendering.
 * Only used during active streaming — completed messages use ReactMarkdown.
 */
export function StreamingText({ content }: StreamingTextProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(undefined);

    useEffect(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
        }

        rafRef.current = requestAnimationFrame(() => {
            const el = containerRef.current;
            if (!el) return;

            // Build DOM safely without innerHTML
            const fragment = document.createDocumentFragment();
            const text = content;

            // Split by newlines, create text nodes and <br> elements
            const lines = text.split("\n");
            for (let i = 0; i < lines.length; i++) {
                if (i > 0) {
                    fragment.appendChild(document.createElement("br"));
                }
                // Parse **bold** segments safely
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

            // Clear and append in one operation
            el.textContent = "";
            el.appendChild(fragment);
        });

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [content]);

    return <div ref={containerRef} className="chat-markdown streaming text-sm" />;
}
