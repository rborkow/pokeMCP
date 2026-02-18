"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingCollapsibleProps {
    content: string;
    isActive: boolean;
}

export function ThinkingCollapsible({ content, isActive }: ThinkingCollapsibleProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Don't render if no thinking content and not active
    if (!content && !isActive) {
        return null;
    }

    // While actively thinking, show animated indicator
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

    // Show collapsible thinking content
    return (
        <div className="thinking-collapsible">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
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
            {isExpanded && <div className="thinking-content">{content}</div>}
        </div>
    );
}
