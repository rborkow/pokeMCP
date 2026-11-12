import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The store persists to IndexedDB, which jsdom does not provide.
vi.mock("@/lib/prep/indexed-db-storage", () => ({
    prepIndexedDbStorage: {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
    },
}));

import { CoachHistory } from "@/components/prep/CoachHistory";
import type { CoachMessage, PrepPlan } from "@/lib/prep/schema";
import { usePrepStore } from "@/stores/prep-store";

const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const plan = { id: PLAN_ID } as PrepPlan;

const messages: CoachMessage[] = [
    {
        id: "22222222-2222-4222-8222-222222222222",
        planId: PLAN_ID,
        role: "user",
        content: "What should I preserve into Trick Room?",
        createdAt: "2026-08-01T10:00:00.000Z",
    },
    {
        id: "33333333-3333-4333-8333-333333333333",
        planId: PLAN_ID,
        role: "assistant",
        content: "Keep Incineroar healthy for the second Fake Out.",
        createdAt: "2026-08-01T10:00:05.000Z",
    },
];

describe("CoachHistory", () => {
    beforeEach(() => {
        usePrepStore.setState({ coachMessages: {} });
    });

    it("renders nothing for a plan that never had a coach conversation", () => {
        const { container } = render(<CoachHistory plan={plan} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows a saved conversation read-only, with no way to ask the retired coach", () => {
        usePrepStore.setState({ coachMessages: { [PLAN_ID]: messages } });
        render(<CoachHistory plan={plan} />);

        expect(screen.getByText("What should I preserve into Trick Room?")).toBeInTheDocument();
        expect(
            screen.getByText("Keep Incineroar healthy for the second Fake Out."),
        ).toBeInTheDocument();
        expect(screen.getByText(/has been retired/)).toBeInTheDocument();
        expect(screen.queryByRole("textbox")).toBeNull();
        expect(screen.queryByRole("button", { name: /ask/i })).toBeNull();
    });

    it("keeps saved conversations in the workspace export", () => {
        usePrepStore.setState({ coachMessages: { [PLAN_ID]: messages } });
        const exported = JSON.parse(usePrepStore.getState().exportWorkspace());
        expect(exported.coachMessages[PLAN_ID]).toEqual(messages);
    });

    it("removes this browser's copy on request and says the synced copy remains", () => {
        usePrepStore.setState({ coachMessages: { [PLAN_ID]: messages } });
        render(<CoachHistory plan={plan} />);

        expect(screen.getByText(/synced copy stays until you delete/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Remove from this browser" }));

        expect(usePrepStore.getState().coachMessages[PLAN_ID]).toEqual([]);
        expect(screen.queryByText("What should I preserve into Trick Room?")).toBeNull();
    });
});
