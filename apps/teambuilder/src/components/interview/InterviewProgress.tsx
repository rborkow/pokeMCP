"use client";

import { INTERVIEW_STEPS } from "@/lib/ai/interview-prompts";
import type { InterviewStepId } from "@/lib/ai/interview-tools";
import { cn } from "@/lib/utils";

export interface InterviewProgressProps {
    currentStep: InterviewStepId;
    answers: Record<InterviewStepId, string | undefined>;
}

export function InterviewProgress({ currentStep, answers }: InterviewProgressProps) {
    const currentIndex = INTERVIEW_STEPS.findIndex((s) => s.id === currentStep);
    const label = INTERVIEW_STEPS[currentIndex]?.label ?? "";

    return (
        <div className="flex items-center justify-between">
            <span className="signal-mono">
                Interview · Step {currentIndex + 1} of 4 · {label}
            </span>
            <div className="flex gap-1" aria-hidden>
                {INTERVIEW_STEPS.map((step, i) => {
                    const done =
                        answers[step.id as InterviewStepId] !== undefined || i < currentIndex;
                    const active = i === currentIndex;
                    return (
                        <span
                            key={step.id}
                            className={cn(
                                "w-5 h-[3px] rounded-sm transition-colors",
                                done || active ? "bg-emerald-500" : "bg-border",
                            )}
                        />
                    );
                })}
            </div>
        </div>
    );
}
