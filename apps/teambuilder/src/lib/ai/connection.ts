import type { StreamChunk, UIMessage, ModelMessage } from "@tanstack/ai";
import type { ConnectConnectionAdapter } from "@tanstack/ai-client";
import type { TeamPokemon, Mode } from "@/types/pokemon";
import type { PersonalityId } from "./personalities";

export interface PokemonChatContext {
    team: TeamPokemon[];
    format: string;
    mode: Mode;
    personality: PersonalityId;
    enableThinking: boolean;
}

/**
 * Extract text content from a UIMessage or ModelMessage.
 * UIMessages store content in parts[]; ModelMessages store it in content.
 */
function extractTextContent(msg: UIMessage | ModelMessage): string {
    // ModelMessage — content is a string, null, or ContentPart[]
    if ("content" in msg && !("parts" in msg)) {
        const c = msg.content;
        if (typeof c === "string") return c;
        if (Array.isArray(c)) {
            const textPart = c.find((p) => p.type === "text");
            return textPart && "content" in textPart ? (textPart.content as string) : "";
        }
        return "";
    }
    // UIMessage — content lives in parts[]
    if ("parts" in msg && Array.isArray(msg.parts)) {
        for (const part of msg.parts) {
            if (part.type === "text") {
                return part.content;
            }
        }
    }
    return "";
}

/**
 * AG-UI SSE stream parser — yields StreamChunk objects from a Response.
 * The server already emits valid AG-UI events (RUN_STARTED, TEXT_MESSAGE_CONTENT, etc.)
 */
async function* parseAGUIStream(response: Response): AsyncGenerator<StreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
            for (const line of event.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6);
                if (!data || data === "[DONE]") continue;
                try {
                    yield JSON.parse(data) as StreamChunk;
                } catch {
                    // skip malformed
                }
            }
        }
    }
}

/**
 * Creates a TanStack AI ConnectConnectionAdapter that sends our
 * custom POST body to the existing /api/ai/claude/stream endpoint.
 *
 * The connect() signature matches ConnectConnectionAdapter from @tanstack/ai-client:
 *   connect(messages, data?, abortSignal?) => AsyncIterable<StreamChunk>
 *
 * We extract the last user message and format chatHistory from the
 * UIMessage array, then POST in the format the server expects.
 */
export function createPokemonChatConnection(
    getContext: () => PokemonChatContext,
): ConnectConnectionAdapter {
    return {
        async *connect(
            messages: Array<UIMessage> | Array<ModelMessage>,
            _data?: Record<string, unknown>,
            signal?: AbortSignal,
        ): AsyncGenerator<StreamChunk> {
            const ctx = getContext();

            // Flatten union for iteration
            const msgs = messages as Array<UIMessage | ModelMessage>;

            // Extract the last user message text
            const userMessages = msgs.filter((m) => m.role === "user");
            const lastUser = userMessages[userMessages.length - 1];
            const messageText = lastUser ? extractTextContent(lastUser) : "";

            // Convert prior messages to simplified chat history
            const chatHistory = msgs
                .slice(0, -1)
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m) => ({
                    role: m.role as "user" | "assistant",
                    content: extractTextContent(m),
                }))
                .filter((m) => m.content.trim());

            const response = await fetch("/api/ai/claude/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: messageText,
                    team: ctx.team,
                    format: ctx.format,
                    mode: ctx.mode,
                    personality: ctx.personality,
                    enableThinking: ctx.enableThinking,
                    chatHistory,
                }),
                signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                yield {
                    type: "RUN_ERROR",
                    timestamp: Date.now(),
                    error: { message: errorText || `Request failed: ${response.status}` },
                } as StreamChunk;
                return;
            }

            yield* parseAGUIStream(response);
        },
    };
}
