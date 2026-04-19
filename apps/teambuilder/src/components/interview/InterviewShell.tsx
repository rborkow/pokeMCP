"use client";

import { useCallback, useEffect, useRef } from "react";
import { INTERVIEW_STEPS } from "@/lib/ai/interview-prompts";
import type { InterviewStepId, InterviewSynthesisInput } from "@/lib/ai/interview-tools";
import type { ModifyTeamInput } from "@/lib/ai/tools";
import { useHistoryStore } from "@/stores/history-store";
import { useInterviewStore } from "@/stores/interview-store";
import { useTeamStore } from "@/stores/team-store";
import { AnswerChip } from "./AnswerChip";
import { InterviewProgress } from "./InterviewProgress";
import { InterviewStep } from "./InterviewStep";
import { SynthesisPreview } from "./SynthesisPreview";

function stepIndex(id: InterviewStepId): number {
    return INTERVIEW_STEPS.findIndex((s) => s.id === id);
}

function nextStepId(current: InterviewStepId): InterviewStepId | null {
    const i = stepIndex(current);
    return i >= 0 && i < INTERVIEW_STEPS.length - 1
        ? (INTERVIEW_STEPS[i + 1].id as InterviewStepId)
        : null;
}

async function* parseAGUIStream(response: Response): AsyncGenerator<Record<string, unknown>> {
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
            for (const line of event.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6);
                if (!data || data === "[DONE]") continue;
                try {
                    yield JSON.parse(data);
                } catch {
                    // skip malformed
                }
            }
        }
    }
}

/**
 * Full-canvas interview surface rendered when the builder has an empty team
 * and the interview hasn't been skipped/applied. Orchestrates step UI,
 * synthesis streaming, preview, and Apply.
 */
export function InterviewShell() {
    const {
        step,
        status,
        answers,
        synthesisIntro,
        proposed,
        synthesisMeta,
        error,
        start,
        setStep,
        setAnswer,
        beginSynthesis,
        appendSynthesisText,
        addProposedAction,
        setSynthesisMeta,
        finishSynthesis,
        markApplied,
        fail,
        skip,
    } = useInterviewStore();

    const teamFormat = useTeamStore((s) => s.format);
    const teamMode = useTeamStore((s) => s.mode);
    const setPokemon = useTeamStore((s) => s.setPokemon);
    const pushHistory = useHistoryStore((s) => s.pushState);

    const abortRef = useRef<AbortController | null>(null);

    // Kick off on mount and keep answers.format in sync with the header.
    useEffect(() => {
        if (status === "idle") {
            start();
        }
    }, [status, start]);

    useEffect(() => {
        if (!answers.format) {
            setAnswer("format", teamFormat);
        }
    }, [answers.format, teamFormat, setAnswer]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") skip();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [skip]);

    const currentStep = INTERVIEW_STEPS.find((s) => s.id === step) ?? INTERVIEW_STEPS[0];

    const runSynthesis = useCallback(async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        beginSynthesis();

        try {
            const response = await fetch("/api/ai/interview/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    answers: {
                        format: answers.format ?? teamFormat,
                        start: answers.start,
                        playstyle: answers.playstyle,
                        preferences: answers.preferences,
                    },
                    format: teamFormat,
                    mode: teamMode,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const text = await response.text();
                fail(text || `Synthesis request failed: ${response.status}`);
                return;
            }

            for await (const event of parseAGUIStream(response)) {
                const type = event.type as string | undefined;
                if (type === "TEXT_MESSAGE_CONTENT") {
                    const delta = event.delta as string | undefined;
                    if (delta) appendSynthesisText(delta);
                }
                if (type === "TOOL_CALL_END") {
                    const name = event.toolName as string | undefined;
                    const input = event.input;
                    if (!input || typeof input !== "object") continue;
                    if (name === "modify_team") {
                        addProposedAction(input as ModifyTeamInput);
                    } else if (name === "interview_synthesis") {
                        const meta = input as InterviewSynthesisInput;
                        setSynthesisMeta({
                            rationale: meta.rationale,
                            considered: meta.considered ?? [],
                            skipped: meta.skipped ?? [],
                        });
                    }
                }
                if (type === "RUN_ERROR") {
                    const err = event.error as { message?: string } | undefined;
                    fail(err?.message ?? "Synthesis failed");
                    return;
                }
                if (type === "RUN_FINISHED") {
                    finishSynthesis();
                    return;
                }
            }
            // Stream ended without RUN_FINISHED — treat as success if we have 6 proposals.
            finishSynthesis();
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
            fail(err instanceof Error ? err.message : "Unknown synthesis error");
        }
    }, [
        addProposedAction,
        answers,
        appendSynthesisText,
        beginSynthesis,
        fail,
        finishSynthesis,
        setSynthesisMeta,
        teamFormat,
        teamMode,
    ]);

    const handleStepSubmit = useCallback(
        (answer: string) => {
            setAnswer(step, answer);
            const next = nextStepId(step);
            if (next) {
                setStep(next);
                return;
            }
            // Last step submitted → kick off synthesis.
            void runSynthesis();
        },
        [step, setAnswer, setStep, runSynthesis],
    );

    const handleApply = useCallback(() => {
        const stagedTeam = [];
        for (const action of proposed) {
            if (action.action_type !== "add_pokemon" || action.pokemon === undefined) continue;
            const pokemon = {
                pokemon: action.pokemon,
                moves: action.moves ?? [],
                ability: action.ability,
                item: action.item,
                nature: action.nature,
                teraType: action.tera_type,
                evs: action.evs,
                ivs: action.ivs,
            };
            setPokemon(action.slot, pokemon, "ai");
            stagedTeam[action.slot] = pokemon;
        }
        pushHistory(stagedTeam.filter(Boolean), "Interview synthesis");
        markApplied();
    }, [proposed, setPokemon, pushHistory, markApplied]);

    const handleDiscard = useCallback(() => {
        abortRef.current?.abort();
        start();
    }, [start]);

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    const priorAnswers = INTERVIEW_STEPS.filter(
        (s) =>
            stepIndex(s.id as InterviewStepId) < stepIndex(step) &&
            answers[s.id as InterviewStepId],
    );

    return (
        <section className="chat-first-surface flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center p-6">
            <div className="chat-first-panel w-full max-w-[640px] rounded-xl p-5 md:p-6 space-y-5">
                <InterviewProgress currentStep={step} answers={answers} />

                {priorAnswers.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {priorAnswers.map((s) => (
                            <AnswerChip
                                key={s.id}
                                step={s}
                                answer={answers[s.id as InterviewStepId] ?? ""}
                                onEdit={() => setStep(s.id as InterviewStepId)}
                            />
                        ))}
                    </div>
                )}

                {status === "synthesizing" || status === "preview" ? (
                    <SynthesisPreview
                        isStreaming={status === "synthesizing"}
                        introText={synthesisIntro}
                        proposed={proposed}
                        meta={synthesisMeta}
                        onApply={handleApply}
                        onDiscard={handleDiscard}
                    />
                ) : (
                    <InterviewStep
                        key={currentStep.id}
                        step={currentStep}
                        initialValue={
                            currentStep.id === "format"
                                ? (answers.format ?? teamFormat)
                                : answers[step]
                        }
                        onSubmit={handleStepSubmit}
                        onSkip={skip}
                    />
                )}

                {status === "error" && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-3 text-[12px] space-y-2">
                        <div className="text-destructive">
                            {error ?? "Synthesis failed."}
                        </div>
                        <button
                            type="button"
                            onClick={() => void runSynthesis()}
                            className="inline-flex items-center rounded-md border border-destructive/60 bg-destructive/20 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/30"
                        >
                            Try again
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
