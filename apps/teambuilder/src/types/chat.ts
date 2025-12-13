import type { TeamPokemon } from "./pokemon";

export type TeamActionType =
  | "add_pokemon"
  | "replace_pokemon"
  | "update_moveset"
  | "remove_pokemon"
  | "update_item"
  | "update_ability";

export interface TeamAction {
  type: TeamActionType;
  slot: number;
  payload: Partial<TeamPokemon>;
  preview: TeamPokemon[];
  reason: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  action?: TeamAction;
  isLoading?: boolean;
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
}

// Suggested prompts for the chat UI
export const SUGGESTED_PROMPTS = [
  {
    label: "Rate my team",
    prompt: "Can you rate my current team and identify its strengths and weaknesses?",
  },
  {
    label: "Improve coverage",
    prompt: "How can I improve my team's type coverage?",
  },
  {
    label: "Counter threats",
    prompt: "What counters the top meta threats that my team struggles against?",
  },
  {
    label: "Suggest teammate",
    prompt: "Who would be a good addition to my team?",
  },
  {
    label: "Optimize sets",
    prompt: "Are there better movesets or EV spreads for my current Pokemon?",
  },
] as const;
