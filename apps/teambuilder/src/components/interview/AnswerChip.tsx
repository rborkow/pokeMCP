"use client";

import type { InterviewStepDefinition } from "@/lib/ai/interview-prompts";

export interface AnswerChipProps {
    step: InterviewStepDefinition;
    answer: string;
    onEdit: () => void;
}

/**
 * Collapsed chip showing a prior step's answer. Click to jump back and
 * replace that answer (the rest of the interview resumes from there).
 */
export function AnswerChip({ step, answer, onEdit }: AnswerChipProps) {
    return (
        <button
            type="button"
            onClick={onEdit}
            className="chat-first-inset group flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:border-border-hairline-strong"
            aria-label={`Edit answer for ${step.label}`}
        >
            <span className="font-mono text-[11px] text-muted-foreground">0{step.index}</span>
            <span className="text-[13px] text-muted-foreground">{step.label}</span>
            <span className="ml-auto truncate text-[13px] font-medium text-foreground">
                {answer}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
                edit
            </span>
        </button>
    );
}
