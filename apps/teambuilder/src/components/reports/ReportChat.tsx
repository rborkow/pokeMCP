"use client";

import { CornerDownLeft, MessageCircle, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * In-context Q&A island on meta-report pages. The page itself is fully
 * prerendered for crawlers; this client component hydrates on top and streams
 * answers from /api/ai/report/stream, grounded in the report's own content.
 */

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface ReportChatProps {
    slug: string;
    month: string;
    reportTitle: string;
}

const SUGGESTED_QUESTIONS = [
    "What should I prepare for in this meta?",
    "Why did the biggest riser gain usage?",
    "What would you run against the top three?",
];

const MAX_QUESTION_CHARS = 500;

export function ReportChat({ slug, month, reportTitle }: ReportChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => () => abortRef.current?.abort(), []);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, [messages]);

    async function ask(question: string) {
        const trimmed = question.trim().slice(0, MAX_QUESTION_CHARS);
        if (!trimmed || streaming) return;
        setError(null);
        setInput("");
        const history = messages;
        setMessages((current) => [
            ...current,
            { role: "user", content: trimmed },
            { role: "assistant", content: "" },
        ]);
        setStreaming(true);

        const controller = new AbortController();
        abortRef.current = controller;

        const appendDelta = (text: string) =>
            setMessages((current) => {
                const next = [...current];
                const last = next[next.length - 1];
                next[next.length - 1] = { ...last, content: last.content + text };
                return next;
            });

        try {
            const response = await fetch("/api/ai/report/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug, month, question: trimmed, history }),
                signal: controller.signal,
            });
            if (!response.ok || !response.body) {
                const detail = await response.json().catch(() => null);
                throw new Error(detail?.error ?? `Request failed (${response.status})`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const event = JSON.parse(line.slice(6)) as {
                        type: string;
                        text?: string;
                        message?: string;
                    };
                    if (event.type === "delta" && event.text) appendDelta(event.text);
                    if (event.type === "error") throw new Error(event.message ?? "Stream error");
                }
            }
        } catch (err) {
            if (!(err instanceof Error && err.name === "AbortError")) {
                setError(err instanceof Error ? err.message : "Something went wrong");
                // Drop the empty assistant placeholder if nothing streamed.
                setMessages((current) =>
                    current[current.length - 1]?.content === "" ? current.slice(0, -1) : current,
                );
            }
        } finally {
            setStreaming(false);
            abortRef.current = null;
        }
    }

    return (
        <section className="chat-first-panel rounded-lg p-5" aria-label="Ask about this report">
            <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                <h2 className="text-base font-semibold text-foreground">Ask about this report</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
                Answers come from “{reportTitle}” — numbers are quoted from the report, not
                invented.
            </p>

            {messages.length === 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {SUGGESTED_QUESTIONS.map((question) => (
                        <button
                            key={question}
                            type="button"
                            onClick={() => ask(question)}
                            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                        >
                            {question}
                        </button>
                    ))}
                </div>
            )}

            {messages.length > 0 && (
                <div
                    ref={scrollRef}
                    className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1"
                    aria-live="polite"
                >
                    {messages.map((message, i) => (
                        <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
                            key={i}
                            className={cn(
                                "whitespace-pre-wrap rounded-md px-3 py-2 text-sm leading-6",
                                message.role === "user"
                                    ? "chat-first-inset ml-8 text-foreground"
                                    : "mr-2 text-muted-foreground",
                            )}
                        >
                            {message.content || (streaming && i === messages.length - 1 ? "…" : "")}
                        </div>
                    ))}
                </div>
            )}

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

            <form
                className="mt-4 flex items-center gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    ask(input);
                }}
            >
                <input
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    maxLength={MAX_QUESTION_CHARS}
                    placeholder="e.g. Is Incineroar worth running right now?"
                    aria-label="Ask a question about this report"
                    className="h-9 flex-1 rounded-md border border-border bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {streaming ? (
                    <button
                        type="button"
                        onClick={() => abortRef.current?.abort()}
                        aria-label="Stop response"
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <Square className="h-3.5 w-3.5" aria-hidden /> Stop
                    </button>
                ) : (
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        aria-label="Send question"
                        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                        <CornerDownLeft className="h-3.5 w-3.5" aria-hidden /> Ask
                    </button>
                )}
            </form>
        </section>
    );
}
