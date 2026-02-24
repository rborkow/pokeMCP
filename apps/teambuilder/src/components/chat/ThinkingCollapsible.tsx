"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface ThinkingCollapsibleProps {
    content: string;
    isActive: boolean;
}

export function ThinkingCollapsible({ content, isActive }: ThinkingCollapsibleProps) {
    const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);
    const [prevIsActive, setPrevIsActive] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Reset manual collapse state when a new thinking session starts
    // Uses React's "adjusting state during render" pattern instead of useEffect
    if (isActive && !prevIsActive) {
        setIsManuallyCollapsed(false);
    }
    if (isActive !== prevIsActive) {
        setPrevIsActive(isActive);
    }

    // Auto-expand while thinking is active; respect manual collapse
    const isExpanded = isActive ? !isManuallyCollapsed : !isManuallyCollapsed && content.length > 0;

    // Auto-scroll the thinking content container during streaming
    useEffect(() => {
        if (isActive && isExpanded && contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [content, isActive, isExpanded]);

    // Don't render if no thinking content and not active
    if (!content && !isActive) {
        return null;
    }

    // While actively thinking with no content yet, show animated indicator
    if (isActive && !content) {
        return (
            <div className="thinking-collapsible">
                <div className="thinking-toggle">
                    <Brain className="h-3.5 w-3.5 animate-thinking-pulse text-primary" />
                    <span>Thinking</span>
                    <div className="flex items-center gap-0.5 ml-1">
                        <span
                            className="w-1 h-1 bg-current rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                        />
                        <span
                            className="w-1 h-1 bg-current rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                        />
                        <span
                            className="w-1 h-1 bg-current rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Collapsible thinking content with auto-expand during streaming
    return (
        <div className={cn("thinking-collapsible", isActive && "border-primary/30 bg-primary/5")}>
            <button
                onClick={() => setIsManuallyCollapsed(!isManuallyCollapsed)}
                className="thinking-toggle"
                type="button"
            >
                <Brain
                    className={cn("h-3.5 w-3.5", isActive && "animate-thinking-pulse text-primary")}
                />
                <span>{isActive ? "Thinking..." : "Show thinking"}</span>
                {isExpanded ? (
                    <ChevronUp className="h-3 w-3 ml-auto" />
                ) : (
                    <ChevronDown className="h-3 w-3 ml-auto" />
                )}
            </button>
            {isExpanded && (
                <div
                    ref={contentRef}
                    className="thinking-content max-h-[300px] overflow-y-auto text-sm [&_p]:my-1 [&_ul]:my-1 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:ml-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:bg-black/10 [&_code]:dark:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs"
                >
                    <ReactMarkdown>{content}</ReactMarkdown>
                </div>
            )}
        </div>
    );
}
