"use client";

import type { StreamChunk } from "@tanstack/ai";
import type { UIMessage } from "@tanstack/ai-client";
import { useChat } from "@tanstack/ai-react";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createPokemonChatConnection } from "@/lib/ai/connection";
import { parseToolToAction } from "@/lib/ai/parse-tool-action";
import type { ModifyTeamInput } from "@/lib/ai/tools";
import { modifyTeamTool } from "@/lib/ai/tools-tanstack";
import { useChatStore } from "@/stores/chat-store";
import { useHistoryStore } from "@/stores/history-store";
import { useTeamStore } from "@/stores/team-store";
import type { TeamAction } from "@/types/chat";
import { ChatInput } from "./ChatInput";
import { type ActiveAssistantStream, ChatMessages } from "./ChatMessages";
import type { LiveTextStreamHandle } from "./LiveTextStream";
import { PersonalitySelector } from "./PersonalitySelector";
import { SuggestedPrompts } from "./SuggestedPrompts";

const MESSAGES_STORAGE_KEY = "pokemcp-chat-messages";

/**
 * Serialize UIMessages for localStorage.
 * Strips any non-serialisable data; createdAt becomes an ISO string.
 */
function serializeMessages(messages: UIMessage[]): string {
    return JSON.stringify(
        messages.map((m) => ({
            ...m,
            createdAt: m.createdAt?.toISOString?.() ?? undefined,
        })),
    );
}

/**
 * Deserialise UIMessages from localStorage, rehydrating Date objects.
 */
function deserializeMessages(raw: string): UIMessage[] {
    try {
        const parsed = JSON.parse(raw) as UIMessage[];
        return parsed.map((m) => ({
            ...m,
            createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
        }));
    } catch {
        return [];
    }
}

export interface ChatPanelProps {
    /** Layout mode. "tab" keeps the existing fixed-height sidebar card (Grid mode);
     * "fill" lets the chat expand to fill its flex/grid container (chat-first frame). */
    layout?: "tab" | "fill";
}

export function ChatPanel({ layout = "tab" }: ChatPanelProps = {}) {
    const { team, setPokemon } = useTeamStore();
    const { pushState } = useHistoryStore();

    const queuedPrompt = useChatStore((s) => s.queuedPrompt);
    const clearQueuedPrompt = useChatStore((s) => s.clearQueuedPrompt);
    const setLastUserPrompt = useChatStore((s) => s.setLastUserPrompt);
    const storeClearChat = useChatStore((s) => s.clearChat);

    // Pending actions for tool approval UI
    const [pendingAction, setPendingAction] = useState<TeamAction | null>(null);
    const [pendingActions, setPendingActions] = useState<TeamAction[]>([]);
    const [activeStream, setActiveStream] = useState<ActiveAssistantStream | null>(null);

    // Stable connection — reads context lazily from store.getState()
    const connection = useMemo(
        () =>
            createPokemonChatConnection(() => ({
                team: useTeamStore.getState().team,
                format: useTeamStore.getState().format,
                mode: useTeamStore.getState().mode,
                personality: useChatStore.getState().personality,
                enableThinking: useChatStore.getState().enableThinking,
            })),
        [],
    );

    // Load persisted messages on mount
    const initialMessages = useMemo(() => {
        if (typeof window === "undefined") return [];
        const raw = localStorage.getItem(MESSAGES_STORAGE_KEY);
        return raw ? deserializeMessages(raw) : [];
    }, []);

    const tools = useMemo(() => [modifyTeamTool] as const, []);

    // Ref to the active live text renderer — push deltas directly for smooth
    // rendering without paying markdown or virtualizer costs mid-stream.
    const streamingRef = useRef<LiveTextStreamHandle | null>(null);
    const textBufferRef = useRef("");
    const pendingToolInputsRef = useRef<ModifyTeamInput[]>([]);
    const streamFinishedRef = useRef(false);
    const thinkingBufferRef = useRef("");
    const thinkingFlushTimerRef = useRef<number | null>(null);

    const clearThinkingFlushTimer = useCallback(() => {
        if (thinkingFlushTimerRef.current !== null) {
            window.clearTimeout(thinkingFlushTimerRef.current);
            thinkingFlushTimerRef.current = null;
        }
    }, []);

    const resetActiveStream = useCallback(() => {
        clearThinkingFlushTimer();
        textBufferRef.current = "";
        thinkingBufferRef.current = "";
        pendingToolInputsRef.current = [];
        streamFinishedRef.current = false;
        streamingRef.current?.clear();
        setActiveStream(null);
    }, [clearThinkingFlushTimer]);

    const ensureActiveStream = useCallback((timestamp?: number, messageId?: string) => {
        const nextTimestamp = timestamp ?? Date.now();
        setActiveStream((prev) => {
            if (prev) {
                return messageId && prev.messageId !== messageId ? { ...prev, messageId } : prev;
            }

            return {
                isActive: true,
                messageId: messageId ?? null,
                createdAt: new Date(nextTimestamp),
                hasText: false,
                initialTextContent: "",
                thinkingContent: "",
                isThinkingActive: false,
                pendingToolCalls: 0,
                finishReason: null,
            };
        });
    }, []);

    const updateActiveStream = useCallback(
        (updater: (current: ActiveAssistantStream | null) => ActiveAssistantStream | null) => {
            setActiveStream((prev) => updater(prev));
        },
        [],
    );

    const flushThinkingContent = useCallback(() => {
        clearThinkingFlushTimer();
        const content = thinkingBufferRef.current;
        updateActiveStream((prev) =>
            prev
                ? {
                      ...prev,
                      thinkingContent: content,
                      isThinkingActive: content.length > 0 || prev.isThinkingActive,
                  }
                : prev,
        );
    }, [clearThinkingFlushTimer, updateActiveStream]);

    const scheduleThinkingFlush = useCallback(() => {
        if (thinkingFlushTimerRef.current !== null) return;
        thinkingFlushTimerRef.current = window.setTimeout(() => {
            flushThinkingContent();
        }, 120);
    }, [flushThinkingContent]);

    const { messages, sendMessage, stop, clear, isLoading, status } = useChat({
        connection,
        tools,
        initialMessages,
        onChunk: (chunk: StreamChunk) => {
            const event = chunk as StreamChunk & {
                type: string;
                timestamp?: number;
                messageId?: string;
                delta?: string;
                input?: unknown;
            };

            if (event.type === "RUN_STARTED") {
                textBufferRef.current = "";
                pendingToolInputsRef.current = [];
                streamFinishedRef.current = false;
                thinkingBufferRef.current = "";
                streamingRef.current?.clear();
                ensureActiveStream(event.timestamp);
                return;
            }

            if (event.type === "TEXT_MESSAGE_CONTENT" && event.delta) {
                textBufferRef.current += event.delta;
                ensureActiveStream(event.timestamp, event.messageId);
                if (streamingRef.current) {
                    streamingRef.current.pushDelta(event.delta);
                }
                updateActiveStream((prev) =>
                    prev
                        ? {
                              ...prev,
                              hasText: true,
                              messageId: event.messageId ?? prev.messageId,
                              initialTextContent: streamingRef.current
                                  ? prev.initialTextContent
                                  : textBufferRef.current,
                          }
                        : {
                              isActive: true,
                              messageId: event.messageId ?? null,
                              createdAt: new Date(event.timestamp ?? Date.now()),
                              hasText: true,
                              initialTextContent: textBufferRef.current,
                              thinkingContent: "",
                              isThinkingActive: false,
                              pendingToolCalls: 0,
                              finishReason: null,
                          },
                );
                return;
            }

            if (event.type === "STEP_STARTED") {
                ensureActiveStream(event.timestamp);
                updateActiveStream((prev) =>
                    prev
                        ? {
                              ...prev,
                              isThinkingActive: true,
                          }
                        : prev,
                );
                return;
            }

            if (event.type === "STEP_FINISHED" && event.delta) {
                ensureActiveStream(event.timestamp);
                thinkingBufferRef.current += event.delta;
                scheduleThinkingFlush();
                return;
            }

            if (event.type === "TOOL_CALL_END" && event.input) {
                const toolName = (event as { toolName?: string }).toolName;
                if (toolName === "present_response_card") {
                    useChatStore.getState().appendResponseCard(event.input);
                    return;
                }
                const input = event.input as ModifyTeamInput;
                pendingToolInputsRef.current.push(input);
                updateActiveStream((prev) =>
                    prev
                        ? {
                              ...prev,
                              pendingToolCalls: pendingToolInputsRef.current.length,
                          }
                        : prev,
                );
                return;
            }

            if (event.type === "RUN_FINISHED" || event.type === "RUN_ERROR") {
                streamFinishedRef.current = true;
                flushThinkingContent();
                updateActiveStream((prev) =>
                    prev
                        ? {
                              ...prev,
                              finishReason: event.type === "RUN_ERROR" ? "error" : "stop",
                          }
                        : prev,
                );
            }
        },
    });

    // Apply multiple actions (for team generation)
    const applyActions = useCallback(
        (actions: TeamAction[]) => {
            actions.forEach((action) => {
                if (action.payload?.pokemon) {
                    setPokemon(
                        action.slot,
                        {
                            pokemon: action.payload.pokemon,
                            moves: action.payload.moves || [],
                            ability: action.payload.ability,
                            item: action.payload.item,
                            nature: action.payload.nature,
                            teraType: action.payload.teraType,
                            evs: action.payload.evs,
                            ivs: action.payload.ivs,
                        },
                        "ai",
                    );
                }
            });

            const lastAction = actions[actions.length - 1];
            if (lastAction?.preview) {
                pushState(lastAction.preview, `Generated ${actions.length} Pokemon team`);
            }
        },
        [setPokemon, pushState],
    );

    // Persist messages to localStorage
    const prevMessagesRef = useRef(messages);
    useEffect(() => {
        if (messages !== prevMessagesRef.current) {
            prevMessagesRef.current = messages;
            try {
                localStorage.setItem(MESSAGES_STORAGE_KEY, serializeMessages(messages));
            } catch {
                // localStorage full — ignore
            }
        }
    }, [messages]);

    const teamRef = useRef(team);
    const applyActionsRef = useRef(applyActions);

    useEffect(() => {
        teamRef.current = team;
        applyActionsRef.current = applyActions;
    });

    const queueBufferedActions = useCallback(() => {
        const currentTeamSnapshot = teamRef.current;
        const newActions: TeamAction[] = [];
        let currentTeam = [...currentTeamSnapshot];

        for (const input of pendingToolInputsRef.current) {
            const action = parseToolToAction(input, currentTeam, newActions.length);
            if (!action) continue;
            newActions.push(action);
            currentTeam = action.preview;
        }

        pendingToolInputsRef.current = [];

        if (newActions.length === 0) return;

        const isTeamGeneration =
            newActions.length > 1 &&
            currentTeamSnapshot.length === 0 &&
            newActions.every((a) => a.type === "add_pokemon");

        if (isTeamGeneration) {
            applyActionsRef.current(newActions);
            return;
        }

        queueMicrotask(() => {
            setPendingAction(newActions[0]);
            setPendingActions(newActions.slice(1));
        });
    }, []);

    useEffect(() => {
        if (isLoading || !streamFinishedRef.current) return;
        queueMicrotask(() => {
            queueBufferedActions();
            resetActiveStream();
        });
    }, [isLoading, queueBufferedActions, resetActiveStream]);

    useEffect(() => {
        return () => {
            clearThinkingFlushTimer();
        };
    }, [clearThinkingFlushTimer]);

    const advancePendingAction = useCallback(() => {
        if (pendingActions.length === 0) {
            setPendingAction(null);
            setPendingActions([]);
            return;
        }
        setPendingAction(pendingActions[0]);
        setPendingActions((prev) => prev.slice(1));
    }, [pendingActions]);

    const handleSend = useCallback(
        async (content: string) => {
            resetActiveStream();
            setLastUserPrompt(content);
            await sendMessage(content);
        },
        [resetActiveStream, sendMessage, setLastUserPrompt],
    );

    const handleStop = useCallback(() => {
        stop();
    }, [stop]);

    const handleClear = useCallback(() => {
        clear();
        storeClearChat();
        setPendingAction(null);
        setPendingActions([]);
        resetActiveStream();
        try {
            localStorage.removeItem(MESSAGES_STORAGE_KEY);
        } catch {
            // ignore
        }
    }, [clear, resetActiveStream, storeClearChat]);

    // Watch for queued prompts from ActionCard retry / suggested prompts
    useEffect(() => {
        if (queuedPrompt && !isLoading) {
            queueMicrotask(() => {
                handleSend(queuedPrompt);
                clearQueuedPrompt();
            });
        }
    }, [queuedPrompt, isLoading, handleSend, clearQueuedPrompt]);

    const outerClass =
        layout === "fill"
            ? "chat-first-panel !p-2 flex flex-col h-full min-h-0"
            : "glass-panel !p-2 flex flex-col h-[min(600px,calc(100vh-12rem))] lg:h-[min(650px,calc(100vh-14rem))]";

    return (
        <div className={outerClass}>
            {/* Header with personality selector and clear button */}
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50 bg-muted/30">
                <PersonalitySelector />
                {messages.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        disabled={isLoading}
                        className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Clear
                    </Button>
                )}
            </div>

            <SuggestedPrompts onSelect={handleSend} disabled={isLoading} />

            <ChatMessages
                messages={messages}
                isLoading={isLoading}
                status={status}
                pendingAction={pendingAction}
                pendingActions={pendingActions}
                advancePendingAction={advancePendingAction}
                activeStream={activeStream}
                streamingRef={streamingRef}
            />
            <ChatInput
                onSend={handleSend}
                onStop={handleStop}
                disabled={isLoading}
                isStreaming={isLoading}
                placeholder={
                    team.length === 0
                        ? "Import a team first, then ask me anything..."
                        : "Ask about your team..."
                }
            />
        </div>
    );
}
