import { beforeEach, describe, expect, it, vi } from "vitest";

const trackAIChatMock = vi.fn();
const messagesCreateMock = vi.fn();

vi.mock("@/lib/ai/analytics", () => ({
    getAnalyticsBinding: () => ({ writeDataPoint: vi.fn() }),
    trackAIChat: (...args: unknown[]) => trackAIChatMock(...args),
    estimateCost: () => 0,
}));

vi.mock("@/lib/ai/anthropic-client", () => ({
    createAnthropicClient: () => ({
        messages: { create: messagesCreateMock },
    }),
}));

// getCloudflareContext is unavailable under vitest; the route catches that.
vi.mock("@opennextjs/cloudflare", () => ({
    getCloudflareContext: () => {
        throw new Error("no cf context in test");
    },
}));

import { POST } from "@/app/api/prep/coach/route";

const POKEMON = { pokemon: "Pikachu", moves: ["Thunderbolt"] };
const NOW = "2026-08-01T00:00:00.000Z";
const TEAM = {
    id: "t1",
    name: "Team",
    format: "champions-regma",
    pokemon: [POKEMON],
    updatedAt: NOW,
};
const EVIDENCE = [
    { id: "e1", kind: "calculated", label: "calc", detail: "detail" },
    { id: "e2", kind: "tournament-source", label: "src", detail: "detail" },
];
const VALID_PLAN = {
    id: "3f4b6f0e-1a2b-4c5d-8e9f-0a1b2c3d4e5f",
    format: "champions-regma",
    ownTeam: TEAM,
    opponentTeam: { ...TEAM, id: "t2" },
    opponentSource: { kind: "manual" },
    battleCard: {
        matchupRoles: [{ pokemon: "Pikachu", role: "lead", note: "n", evidenceIds: ["e1"] }],
        bringFour: ["Pikachu", "A", "B", "C"],
        leadPlans: [
            { pokemon: ["Pikachu", "A"], purpose: "p", useWhen: "w", evidenceIds: ["e1"] },
            { pokemon: ["B", "C"], purpose: "p", useWhen: "w", evidenceIds: ["e2"] },
        ],
        likelyOpponentLeads: [
            { pokemon: ["X", "Y"], purpose: "p", useWhen: "w", evidenceIds: ["e2"] },
        ],
        openingLines: [
            {
                lead: ["Pikachu", "A"],
                primary: "p",
                alternative: "a",
                evidenceIds: ["e1"],
            },
        ],
        dangerPoints: [{ title: "t", detail: "d", response: "r", evidenceIds: ["e1"] }],
        practiceChecklist: [
            { label: "a", done: false },
            { label: "b", done: false },
            { label: "c", done: false },
        ],
        evidence: EVIDENCE,
    },
    mechanicsVersion: "v1",
    status: "complete",
    createdAt: NOW,
    updatedAt: NOW,
};

function request(body: unknown): Request {
    return new Request("http://localhost:3000/api/prep/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("prep coach analytics", () => {
    beforeEach(() => {
        trackAIChatMock.mockClear();
        messagesCreateMock.mockReset();
    });

    it("tracks actual Anthropic usage with source=prep on success", async () => {
        messagesCreateMock.mockResolvedValue({
            content: [{ type: "text", text: "Play aggressively." }],
            usage: {
                input_tokens: 1200,
                output_tokens: 300,
                cache_creation_input_tokens: 100,
                cache_read_input_tokens: 50,
            },
        });

        const res = await POST(request({ plan: VALID_PLAN, question: "How do I lead?" }) as never);
        expect(res.status).toBe(200);

        expect(trackAIChatMock).toHaveBeenCalledTimes(1);
        const [, event] = trackAIChatMock.mock.calls[0];
        expect(event).toMatchObject({
            source: "prep",
            mode: "vgc",
            inputTokens: 1200,
            outputTokens: 300,
            cacheCreationTokens: 100,
            cacheReadTokens: 50,
        });
        expect(event.format).toBe("champions-regma");
    });

    it("does not emit successful usage when the Anthropic call fails", async () => {
        messagesCreateMock.mockRejectedValue(new Error("anthropic down"));

        const res = await POST(request({ plan: VALID_PLAN, question: "lead?" }) as never);
        expect(res.status).toBe(503);
        expect(trackAIChatMock).not.toHaveBeenCalled();
    });
});
