"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";

interface ChatInputProps {
    onSend: (message: string) => void;
    onStop?: () => void;
    disabled?: boolean;
    isStreaming?: boolean;
    placeholder?: string;
}

export function ChatInput({
    onSend,
    onStop,
    disabled = false,
    isStreaming = false,
    placeholder = "Ask about your team...",
}: ChatInputProps) {
    const [input, setInput] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { enableThinking, toggleThinking } = useChatStore();

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
    }, [input]);

    const handleSend = () => {
        const trimmed = input.trim();
        if (trimmed && !disabled) {
            onSend(trimmed);
            setInput("");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        // Escape key stops streaming
        if (e.key === "Escape" && isStreaming && onStop) {
            e.preventDefault();
            onStop();
        }
    };

    return (
        <div className="flex items-end gap-2 p-4 border-t">
            <Button
                onClick={toggleThinking}
                variant="ghost"
                size="icon"
                className={cn(
                    "h-10 w-10 flex-shrink-0",
                    enableThinking
                        ? "text-primary bg-primary/10 hover:bg-primary/20"
                        : "text-muted-foreground hover:text-foreground",
                )}
                title={enableThinking ? "Deep thinking enabled" : "Enable deep thinking"}
            >
                <Brain className="h-4 w-4" />
            </Button>
            <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled && !isStreaming}
                className="min-h-[40px] max-h-[120px] resize-none"
                rows={1}
            />
            {isStreaming ? (
                <Button
                    onClick={onStop}
                    size="icon"
                    variant="destructive"
                    className="h-10 w-10 flex-shrink-0"
                    title="Stop generating (Esc)"
                >
                    <Square className="h-4 w-4" />
                </Button>
            ) : (
                <Button
                    onClick={handleSend}
                    disabled={disabled || !input.trim()}
                    size="icon"
                    className="h-10 w-10 flex-shrink-0"
                >
                    <Send className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}
