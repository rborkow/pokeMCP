import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { prepIndexedDbStorage } from "@/lib/prep/indexed-db-storage";
import {
    CoachMessageSchema,
    PrepPlanSchema,
    type CoachMessage,
    type PrepPlan,
    TeamSnapshotSchema,
    type TeamSnapshot,
} from "@/lib/prep/schema";

interface PrepState {
    teams: TeamSnapshot[];
    plans: PrepPlan[];
    coachMessages: Record<string, CoachMessage[]>;
    legacyMigrationComplete: boolean;
    saveTeam: (team: TeamSnapshot) => void;
    removeTeam: (id: string) => void;
    savePlan: (plan: PrepPlan) => void;
    updatePlan: (id: string, update: Partial<PrepPlan>) => void;
    removePlan: (id: string) => void;
    addCoachMessage: (message: CoachMessage) => void;
    clearCoachHistory: (planId: string) => void;
    replaceWorkspace: (workspace: {
        teams: TeamSnapshot[];
        plans: PrepPlan[];
        coachMessages: Record<string, CoachMessage[]>;
    }) => void;
    markLegacyMigrationComplete: () => void;
    exportWorkspace: () => string;
}

const upsertById = <T extends { id: string }>(items: T[], item: T) => {
    const existing = items.findIndex((candidate) => candidate.id === item.id);
    if (existing === -1) return [item, ...items];
    const next = [...items];
    next[existing] = item;
    return next;
};

export const usePrepStore = create<PrepState>()(
    persist(
        (set, get) => ({
            teams: [],
            plans: [],
            coachMessages: {},
            legacyMigrationComplete: false,
            saveTeam: (team) =>
                set((state) => ({ teams: upsertById(state.teams, TeamSnapshotSchema.parse(team)) })),
            removeTeam: (id) => set((state) => ({ teams: state.teams.filter((team) => team.id !== id) })),
            savePlan: (plan) =>
                set((state) => ({ plans: upsertById(state.plans, PrepPlanSchema.parse(plan)) })),
            updatePlan: (id, update) =>
                set((state) => ({
                    plans: state.plans.map((plan) =>
                        plan.id === id
                            ? PrepPlanSchema.parse({
                                  ...plan,
                                  ...update,
                                  id,
                                  updatedAt: new Date().toISOString(),
                              })
                            : plan,
                    ),
                })),
            removePlan: (id) =>
                set((state) => ({
                    plans: state.plans.filter((plan) => plan.id !== id),
                    coachMessages: Object.fromEntries(
                        Object.entries(state.coachMessages).filter(([planId]) => planId !== id),
                    ),
                })),
            addCoachMessage: (message) =>
                set((state) => {
                    const parsed = CoachMessageSchema.parse(message);
                    return {
                        coachMessages: {
                            ...state.coachMessages,
                            [parsed.planId]: [
                                ...(state.coachMessages[parsed.planId] ?? []),
                                parsed,
                            ].slice(-20),
                        },
                    };
                }),
            clearCoachHistory: (planId) =>
                set((state) => ({
                    coachMessages: { ...state.coachMessages, [planId]: [] },
                })),
            replaceWorkspace: (workspace) =>
                set({
                    teams: workspace.teams.map((team) => TeamSnapshotSchema.parse(team)),
                    plans: workspace.plans.map((plan) => PrepPlanSchema.parse(plan)),
                    coachMessages: Object.fromEntries(
                        Object.entries(workspace.coachMessages).map(([planId, messages]) => [
                            planId,
                            messages.map((message) => CoachMessageSchema.parse(message)).slice(-20),
                        ]),
                    ),
                }),
            markLegacyMigrationComplete: () => set({ legacyMigrationComplete: true }),
            exportWorkspace: () =>
                JSON.stringify(
                    {
                        version: 1,
                        exportedAt: new Date().toISOString(),
                        teams: get().teams,
                        plans: get().plans,
                        coachMessages: get().coachMessages,
                    },
                    null,
                    2,
                ),
        }),
        {
            name: "pokemcp-prep-workspace",
            version: 1,
            storage: createJSONStorage(() => prepIndexedDbStorage),
            partialize: ({ teams, plans, coachMessages, legacyMigrationComplete }) => ({
                teams,
                plans,
                coachMessages,
                legacyMigrationComplete,
            }),
        },
    ),
);
