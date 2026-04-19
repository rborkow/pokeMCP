import type Anthropic from "@anthropic-ai/sdk";
import { TEAM_TOOLS } from "./tools";

export type InterviewStepId = "format" | "start" | "playstyle" | "preferences";

/**
 * Emitted at the end of synthesis with a short rationale + what was
 * considered / skipped. The six `modify_team` calls deliver the actual team.
 */
export interface InterviewSynthesisInput {
    rationale: string;
    considered: string[];
    skipped: string[];
}

export const INTERVIEW_SYNTHESIS_TOOL: Anthropic.Messages.Tool = {
    name: "interview_synthesis",
    description:
        "Record the overall rationale for the synthesized team. Call exactly once at the end of synthesis, AFTER the six modify_team calls.",
    input_schema: {
        type: "object",
        properties: {
            rationale: {
                type: "string",
                description: "1-2 sentences describing the team's overall game plan.",
            },
            considered: {
                type: "array",
                items: { type: "string" },
                description: "2-3 items that were evaluated and kept.",
            },
            skipped: {
                type: "array",
                items: { type: "string" },
                description: "1-2 items that were evaluated and deliberately not included.",
            },
        },
        required: ["rationale", "considered", "skipped"],
    },
};

/** Tools the synthesis endpoint exposes to Claude. */
export const INTERVIEW_SYNTHESIS_TOOLS: Anthropic.Messages.Tool[] = [
    ...(TEAM_TOOLS as Anthropic.Messages.Tool[]),
    INTERVIEW_SYNTHESIS_TOOL,
];
