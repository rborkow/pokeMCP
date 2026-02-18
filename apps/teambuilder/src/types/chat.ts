import type { TeamPokemon } from "./pokemon";
import type { ValidationError } from "@/lib/validation/pokemon";

export type TeamActionType =
    | "add_pokemon"
    | "replace_pokemon"
    | "update_moveset"
    | "remove_pokemon"
    | "update_item"
    | "update_ability"
    | "update_nature"
    | "update_evs"
    | "update_tera_type"
    | "update_move"; // Single move change (requires moveSlot in payload)

export interface TeamAction {
    type: TeamActionType;
    slot: number;
    payload: Partial<TeamPokemon>;
    preview: TeamPokemon[];
    reason: string;
    validationErrors?: ValidationError[];
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
    action?: TeamAction;
    isLoading?: boolean;
    thinkingContent?: string;
    buildingStatus?: string; // Status message when building team via tools
}

export type AIProvider = "cloudflare" | "claude";

export interface AIContext {
    team: TeamPokemon[];
    format: string;
    chatHistory: ChatMessage[];
}

export interface AIResponse {
    content: string;
    action?: TeamAction;
    actions?: TeamAction[]; // Multiple actions for team generation
    rawContent?: string; // Original response for retry
}

// Suggested prompts for the chat UI
export const SUGGESTED_PROMPTS = [
    {
        label: "Rate my team",
        prompt: "Can you rate my current team and identify its strengths and weaknesses?",
        requiresTeam: true,
    },
    {
        label: "Improve coverage",
        prompt: "How can I improve my team's type coverage?",
        requiresTeam: false,
    },
    {
        label: "Counter threats",
        prompt: "What counters the top meta threats that my team struggles against?",
        requiresTeam: false,
    },
    {
        label: "Suggest teammate",
        prompt: "Who would be a good addition to my team?",
        requiresTeam: false,
    },
    {
        label: "Optimize sets",
        prompt: "Are there better movesets or EV spreads for my current Pokemon?",
        requiresTeam: true,
    },
] as const;

// Quickstart prompt shown when team is empty
export const QUICKSTART_PROMPT = {
    label: "✨ Generate Team",
    prompt: "Build me a competitive 6 Pokemon team for the current format. Include a good balance of offensive and defensive Pokemon with strong type synergy. For each Pokemon, use an ACTION block with full competitive sets including EVs, nature, and tera type.",
};
