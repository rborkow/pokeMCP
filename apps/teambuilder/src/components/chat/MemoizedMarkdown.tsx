"use client";

import { memo, useMemo } from "react";
import { marked } from "marked";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const MarkdownBlock = memo(
    function MarkdownBlock({ content }: { content: string }) {
        return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
    },
    (prev, next) => prev.content === next.content,
);

interface MemoizedMarkdownProps {
    content: string;
    /** Pre-computed blocks (from incremental tokenizer). If provided, skips lexing. */
    blocks?: string[];
    /** Number of blocks that are "cached" (stable keys) vs trailing (content keys). */
    cachedCount?: number;
    /** Whether the content is actively streaming — enables cursor CSS. */
    isStreaming?: boolean;
}

/**
 * Block-level memoized markdown renderer.
 *
 * Each block is rendered by a memoized `<ReactMarkdown>` component.
 * During streaming, the parent (`StreamingMarkdown`) provides pre-computed
 * blocks via the `blocks` prop to avoid full re-tokenization in render.
 * For completed messages, `content` is tokenized via `marked.lexer()`.
 */
export function MemoizedMarkdown({
    content,
    blocks: precomputedBlocks,
    cachedCount = 0,
    isStreaming = false,
}: MemoizedMarkdownProps) {
    const blocks = useMemo(() => {
        // If parent provided pre-computed blocks, use them (streaming path)
        if (precomputedBlocks) return precomputedBlocks;

        // Otherwise, full parse (completed messages)
        if (!content) return [];
        const tokens = marked.lexer(content);
        return tokens.map((t) => t.raw);
    }, [content, precomputedBlocks]);

    return (
        <div className={cn("chat-markdown text-sm", isStreaming && "streaming")}>
            {blocks.map((block, i) => {
                // Cached (completed) blocks get stable index keys — they never change.
                // Trailing blocks get content-prefix keys for React reconciliation.
                const isCached = isStreaming && i < cachedCount;
                const key = isCached ? `b-${i}` : `t-${i}-${block.substring(0, 40)}`;
                return <MarkdownBlock key={key} content={block} />;
            })}
        </div>
    );
}

// --- Incremental tokenization utilities (used by StreamingMarkdown) ---

/**
 * Find the boundary between "stable" (complete) blocks and the trailing
 * incomplete text. A block boundary is a blank line (\n\n) that isn't
 * inside an unclosed code fence (``` or ~~~).
 */
export function findStableBoundary(content: string): number {
    let fenceOpen = false;
    let lastBoundary = 0;

    const lines = content.split("\n");
    let offset = 0;

    for (const line of lines) {
        if (/^(`{3,}|~{3,})/.test(line.trimStart())) {
            fenceOpen = !fenceOpen;
        }

        offset += line.length + 1; // +1 for \n

        if (!fenceOpen && line === "" && offset > 1) {
            lastBoundary = offset;
        }
    }

    return lastBoundary;
}

export interface BlockCache {
    blocks: string[];
    length: number;
}

/**
 * Incrementally tokenize content — cache completed blocks, only re-parse
 * the trailing incomplete text.
 */
export function tokenizeIncremental(
    content: string,
    cache: BlockCache,
): { blocks: string[]; cachedCount: number; cache: BlockCache } {
    const boundary = findStableBoundary(content);

    let cachedBlocks = cache.blocks;
    let cachedLength = cache.length;

    if (boundary > cachedLength) {
        const newStableText = content.slice(cachedLength, boundary);
        const newTokens = marked.lexer(newStableText);
        cachedBlocks = [...cachedBlocks, ...newTokens.map((t) => t.raw)];
        cachedLength = boundary;
    }

    const trailing = content.slice(boundary);
    const trailingBlocks = trailing ? marked.lexer(trailing).map((t) => t.raw) : [];

    return {
        blocks: [...cachedBlocks, ...trailingBlocks],
        cachedCount: cachedBlocks.length,
        cache: { blocks: cachedBlocks, length: cachedLength },
    };
}
