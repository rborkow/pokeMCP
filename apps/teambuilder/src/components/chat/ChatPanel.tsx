"use client";

import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useChat } from "@tanstack/ai-react";
import type { UIMessage } from "@tanstack/ai-client";
import { Button } from "@/components/ui/button";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { PersonalitySelector } from "./PersonalitySelector";
import { useChatStore } from "@/stores/chat-store";
import { useTeamStore } from "@/stores/team-store";
import { useHistoryStore } from "@/stores/history-store";
import { createPokemonChatConnection } from "@/lib/ai/connection";
import { modifyTeamTool } from "@/lib/ai/tools-tanstack";
import { parseToolToAction } from "@/lib/ai/parse-tool-action";
import { Trash2 } from "lucide-react";
import type { TeamAction } from "@/types/chat";
import type { ModifyTeamInput } from "@/lib/ai/tools";

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

export function ChatPanel() {
    const { team, setPokemon } = useTeamStore();
    const { pushState } = useHistoryStore();

    const queuedPrompt = useChatStore((s) => s.queuedPrompt);
    const clearQueuedPrompt = useChatStore((s) => s.clearQueuedPrompt);
    const setLastUserPrompt = useChatStore((s) => s.setLastUserPrompt);
    const storeClearChat = useChatStore((s) => s.clearChat);

    // Pending actions for tool approval UI
    const [pendingAction, setPendingAction] = useState<TeamAction | null>(null);
    const [pendingActions, setPendingActions] = useState<TeamAction[]>([]);

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

    const { messages, sendMessage, stop, clear, isLoading, status } = useChat({
        connection,
        tools,
        initialMessages,
    });

    // Apply multiple actions (for team generation)
    const applyActions = useCallback(
        (actions: TeamAction[]) => {
            actions.forEach((action, index) => {
                if (action.payload?.pokemon) {
                    setPokemon(index, {
                        pokemon: action.payload.pokemon,
                        moves: action.payload.moves || [],
                        ability: action.payload.ability,
                        item: action.payload.item,
                        nature: action.payload.nature,
                        teraType: action.payload.teraType,
                        evs: action.payload.evs,
                        ivs: action.payload.ivs,
                    });
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

    // Process tool calls from assistant messages into TeamActions
    // This runs when messages change and detects new tool-call parts needing approval
    const processedToolCallsRef = useRef(new Set<string>());
    const teamRef = useRef(team);
    teamRef.current = team;
    const applyActionsRef = useRef(applyActions);
    applyActionsRef.current = applyActions;

    useEffect(() => {
        if (isLoading) return; // Wait until stream finishes

        const currentTeamSnapshot = teamRef.current;
        const newActions: TeamAction[] = [];
        let currentTeam = [...currentTeamSnapshot];

        for (const msg of messages) {
            if (msg.role !== "assistant") continue;
            for (const part of msg.parts) {
                if (part.type !== "tool-call") continue;
                if (processedToolCallsRef.current.has(part.id)) continue;
                if (part.state !== "approval-requested") continue;

                processedToolCallsRef.current.add(part.id);

                // Parse tool input to TeamAction
                const input = (typeof part.input === "object" ? part.input : undefined) as
                    | ModifyTeamInput
                    | undefined;
                if (!input) continue;

                const action = parseToolToAction(input, currentTeam, newActions.length);
                if (action) {
                    // Attach the approval ID so we can respond later
                    (action as TeamAction & { _approvalId?: string })._approvalId =
                        part.approval?.id;
                    newActions.push(action);
                    currentTeam = action.preview;
                }
            }
        }

        if (newActions.length === 0) return;

        // Auto-apply for team generation (all adds to empty team)
        const isTeamGeneration =
            newActions.length > 1 &&
            currentTeamSnapshot.length === 0 &&
            newActions.every((a) => a.type === "add_pokemon");

        if (isTeamGeneration) {
            applyActionsRef.current(newActions);
        } else if (newActions.length === 1) {
            setPendingAction(newActions[0]);
        } else {
            setPendingAction(newActions[0]);
            setPendingActions(newActions.slice(1));
        }
    }, [messages, isLoading]);

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
            setLastUserPrompt(content);
            await sendMessage(content);
        },
        [sendMessage, setLastUserPrompt],
    );

    const handleStop = useCallback(() => {
        stop();
    }, [stop]);

    const handleClear = useCallback(() => {
        clear();
        storeClearChat();
        setPendingAction(null);
        setPendingActions([]);
        processedToolCallsRef.current.clear();
        try {
            localStorage.removeItem(MESSAGES_STORAGE_KEY);
        } catch {
            // ignore
        }
    }, [clear, storeClearChat]);

    // Watch for queued prompts from WelcomeOverlay
    useEffect(() => {
        if (queuedPrompt && !isLoading) {
            handleSend(queuedPrompt);
            clearQueuedPrompt();
        }
    }, [queuedPrompt, isLoading, handleSend, clearQueuedPrompt]);

    return (
        <div className="glass-panel !p-2 flex flex-col h-[min(600px,calc(100vh-12rem))] lg:h-[min(650px,calc(100vh-14rem))]">
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
