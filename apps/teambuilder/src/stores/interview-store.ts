import { create } from "zustand";
import type { InterviewStepId } from "@/lib/ai/interview-tools";
import type { ModifyTeamInput } from "@/lib/ai/tools";

export type InterviewStatus =
    | "idle"
    | "asking"
    | "synthesizing"
    | "preview"
    | "applied"
    | "skipped"
    | "error";

export interface SynthesisMeta {
    rationale: string;
    considered: string[];
    skipped: string[];
}

interface InterviewState {
    step: InterviewStepId;
    status: InterviewStatus;
    answers: Record<InterviewStepId, string | undefined>;
    /** Streaming text the model emits while synthesizing. */
    synthesisIntro: string;
    /** Accumulated `modify_team` tool inputs staged for Apply. */
    proposed: ModifyTeamInput[];
    synthesisMeta: SynthesisMeta | null;
    error: string | null;

    // Actions
    start: () => void;
    setStep: (step: InterviewStepId) => void;
    setAnswer: (step: InterviewStepId, answer: string) => void;
    beginSynthesis: () => void;
    appendSynthesisText: (delta: string) => void;
    addProposedAction: (input: ModifyTeamInput) => void;
    setSynthesisMeta: (meta: SynthesisMeta) => void;
    finishSynthesis: () => void;
    markApplied: () => void;
    fail: (message: string) => void;
    skip: () => void;
    reset: () => void;
}

const INITIAL_ANSWERS: Record<InterviewStepId, string | undefined> = {
    format: undefined,
    start: undefined,
    playstyle: undefined,
    preferences: undefined,
};

export const useInterviewStore = create<InterviewState>()((set) => ({
    step: "format",
    status: "idle",
    answers: { ...INITIAL_ANSWERS },
    synthesisIntro: "",
    proposed: [],
    synthesisMeta: null,
    error: null,

    start: () =>
        set({
            step: "format",
            status: "asking",
            answers: { ...INITIAL_ANSWERS },
            synthesisIntro: "",
            proposed: [],
            synthesisMeta: null,
            error: null,
        }),

    setStep: (step) => set({ step }),

    setAnswer: (step, answer) =>
        set((state) => ({
            answers: { ...state.answers, [step]: answer },
        })),

    beginSynthesis: () =>
        set({
            status: "synthesizing",
            synthesisIntro: "",
            proposed: [],
            synthesisMeta: null,
            error: null,
        }),

    appendSynthesisText: (delta) =>
        set((state) => ({ synthesisIntro: state.synthesisIntro + delta })),

    addProposedAction: (input) => set((state) => ({ proposed: [...state.proposed, input] })),

    setSynthesisMeta: (meta) => set({ synthesisMeta: meta }),

    finishSynthesis: () => set({ status: "preview" }),

    markApplied: () => set({ status: "applied" }),

    fail: (message) => set({ status: "error", error: message }),

    skip: () =>
        set({
            status: "skipped",
            synthesisIntro: "",
            proposed: [],
            synthesisMeta: null,
            error: null,
        }),

    reset: () =>
        set({
            step: "format",
            status: "idle",
            answers: { ...INITIAL_ANSWERS },
            synthesisIntro: "",
            proposed: [],
            synthesisMeta: null,
            error: null,
        }),
}));
