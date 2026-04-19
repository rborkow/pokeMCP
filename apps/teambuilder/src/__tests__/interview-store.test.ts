import { beforeEach, describe, expect, it } from "vitest";
import type { ModifyTeamInput } from "@/lib/ai/tools";
import { useInterviewStore } from "@/stores/interview-store";

describe("interview-store", () => {
    beforeEach(() => {
        useInterviewStore.getState().reset();
    });

    it("defaults to idle with no answers", () => {
        const state = useInterviewStore.getState();
        expect(state.status).toBe("idle");
        expect(state.step).toBe("format");
        expect(state.answers).toEqual({
            format: undefined,
            start: undefined,
            playstyle: undefined,
            preferences: undefined,
        });
    });

    it("start() moves to asking and clears prior state", () => {
        useInterviewStore.getState().setAnswer("format", "gen9ou");
        useInterviewStore.getState().fail("boom");
        useInterviewStore.getState().start();

        const state = useInterviewStore.getState();
        expect(state.status).toBe("asking");
        expect(state.answers.format).toBeUndefined();
        expect(state.error).toBeNull();
    });

    it("setAnswer records an answer without changing status", () => {
        useInterviewStore.getState().start();
        useInterviewStore.getState().setAnswer("start", "clean slate");
        expect(useInterviewStore.getState().answers.start).toBe("clean slate");
        expect(useInterviewStore.getState().status).toBe("asking");
    });

    it("beginSynthesis and finishSynthesis transition through states correctly", () => {
        useInterviewStore.getState().start();
        useInterviewStore.getState().beginSynthesis();
        expect(useInterviewStore.getState().status).toBe("synthesizing");
        useInterviewStore.getState().finishSynthesis();
        expect(useInterviewStore.getState().status).toBe("preview");
    });

    it("accumulates proposed modify_team actions in order", () => {
        useInterviewStore.getState().start();
        useInterviewStore.getState().beginSynthesis();

        const a: ModifyTeamInput = {
            action_type: "add_pokemon",
            slot: 0,
            reason: "lead",
            pokemon: "Great Tusk",
        };
        const b: ModifyTeamInput = {
            action_type: "add_pokemon",
            slot: 1,
            reason: "breaker",
            pokemon: "Kingambit",
        };

        useInterviewStore.getState().addProposedAction(a);
        useInterviewStore.getState().addProposedAction(b);

        expect(useInterviewStore.getState().proposed).toEqual([a, b]);
    });

    it("skip() moves into skipped and clears synthesis artifacts", () => {
        useInterviewStore.getState().start();
        useInterviewStore.getState().addProposedAction({
            action_type: "add_pokemon",
            slot: 0,
            reason: "test",
        });
        useInterviewStore.getState().appendSynthesisText("hello");
        useInterviewStore.getState().skip();

        const state = useInterviewStore.getState();
        expect(state.status).toBe("skipped");
        expect(state.proposed).toEqual([]);
        expect(state.synthesisIntro).toBe("");
    });

    it("markApplied parks the store at applied so future renders skip the interview", () => {
        useInterviewStore.getState().start();
        useInterviewStore.getState().beginSynthesis();
        useInterviewStore.getState().finishSynthesis();
        useInterviewStore.getState().markApplied();
        expect(useInterviewStore.getState().status).toBe("applied");
    });

    it("fail() surfaces the error message and leaves the user at the failed state", () => {
        useInterviewStore.getState().start();
        useInterviewStore.getState().beginSynthesis();
        useInterviewStore.getState().fail("synthesis blew up");
        const state = useInterviewStore.getState();
        expect(state.status).toBe("error");
        expect(state.error).toBe("synthesis blew up");
    });
});
