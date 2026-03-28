"use client";

import { memo, useMemo } from "react";
import { marked } from "marked";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MarkdownBlock = memo(
    function MarkdownBlock({ content }: { content: string }) {
        return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
    },
    (prev, next) => prev.content === next.content,
);

export function MemoizedMarkdown({ content }: { content: string }) {
    const blocks = useMemo(() => {
        if (!content) return [];
        const tokens = marked.lexer(content);
        return tokens.map((t) => t.raw);
    }, [content]);

    return (
        <div className="chat-markdown text-sm">
            {blocks.map((block, i) => (
                <MarkdownBlock key={`${i}-${block.substring(0, 40)}`} content={block} />
            ))}
        </div>
    );
}
