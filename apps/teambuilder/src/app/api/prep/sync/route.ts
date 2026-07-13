import type { NextRequest } from "next/server";
import { z } from "zod";
import { AuthUnavailableError, getAuth, getPrepCloudflareEnv } from "@/lib/auth";
import {
    CoachMessageSchema,
    PrepPlanSchema,
    TeamSnapshotSchema,
    type CoachMessage,
    type PrepPlan,
    type TeamSnapshot,
} from "@/lib/prep/schema";

const SyncPayloadSchema = z.object({
    teams: z.array(TeamSnapshotSchema).max(50),
    plans: z.array(PrepPlanSchema).max(100),
    coachMessages: z.record(z.string(), z.array(CoachMessageSchema).max(20)),
});

interface JsonRow {
    data_json: string;
}

interface MessageRow {
    id: string;
    plan_id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
}

async function getUserId(request: NextRequest) {
    const session = await getAuth().api.getSession({ headers: request.headers });
    return session?.user.id ?? null;
}

async function readWorkspace(userId: string) {
    const env = getPrepCloudflareEnv();
    const [teamRows, planRows, messageRows] = await Promise.all([
        env.PREP_DB.prepare("SELECT data_json FROM prep_team WHERE user_id = ? ORDER BY updated_at DESC")
            .bind(userId)
            .all<JsonRow>(),
        env.PREP_DB.prepare("SELECT data_json FROM prep_plan WHERE user_id = ? ORDER BY updated_at DESC")
            .bind(userId)
            .all<JsonRow>(),
        env.PREP_DB.prepare("SELECT id, plan_id, role, content, created_at FROM prep_message WHERE user_id = ? ORDER BY created_at ASC")
            .bind(userId)
            .all<MessageRow>(),
    ]);
    const teams = teamRows.results
        .map((row) => TeamSnapshotSchema.safeParse(JSON.parse(row.data_json)))
        .filter((result) => result.success)
        .map((result) => result.data);
    const plans = planRows.results
        .map((row) => PrepPlanSchema.safeParse(JSON.parse(row.data_json)))
        .filter((result) => result.success)
        .map((result) => result.data);
    const coachMessages: Record<string, CoachMessage[]> = {};
    for (const row of messageRows.results) {
        const parsed = CoachMessageSchema.safeParse({
            id: row.id,
            planId: row.plan_id,
            role: row.role,
            content: row.content,
            createdAt: row.created_at,
        });
        if (!parsed.success) continue;
        coachMessages[row.plan_id] = [...(coachMessages[row.plan_id] ?? []), parsed.data].slice(-20);
    }
    return { teams, plans, coachMessages };
}

function mergeByUpdatedAt<T extends { id: string; updatedAt: string }>(server: T[], local: T[]) {
    const merged = new Map(server.map((item) => [item.id, item]));
    for (const item of local) {
        const existing = merged.get(item.id);
        if (!existing || item.updatedAt > existing.updatedAt) merged.set(item.id, item);
    }
    return [...merged.values()];
}

async function upsertWorkspace(
    userId: string,
    local: { teams: TeamSnapshot[]; plans: PrepPlan[]; coachMessages: Record<string, CoachMessage[]> },
) {
    const env = getPrepCloudflareEnv();
    const server = await readWorkspace(userId);
    const teams = mergeByUpdatedAt(server.teams, local.teams);
    const plans = mergeByUpdatedAt(server.plans, local.plans);
    const serverMessages = Object.values(server.coachMessages).flat();
    const localMessages = Object.values(local.coachMessages).flat();
    const messages = [...new Map([...serverMessages, ...localMessages].map((item) => [item.id, item])).values()];

    for (const team of teams) {
        await env.PREP_DB.prepare(
            `INSERT INTO prep_team (id, user_id, name, format, data_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, format = excluded.format,
                 data_json = excluded.data_json, updated_at = excluded.updated_at
             WHERE prep_team.user_id = excluded.user_id AND excluded.updated_at > prep_team.updated_at`,
        )
            .bind(team.id, userId, team.name, team.format, JSON.stringify(team), team.updatedAt, team.updatedAt)
            .run();
    }
    for (const plan of plans) {
        await env.PREP_DB.prepare(
            `INSERT INTO prep_plan (id, user_id, format, data_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET format = excluded.format, data_json = excluded.data_json,
                 updated_at = excluded.updated_at
             WHERE prep_plan.user_id = excluded.user_id AND excluded.updated_at > prep_plan.updated_at`,
        )
            .bind(plan.id, userId, plan.format, JSON.stringify(plan), plan.createdAt, plan.updatedAt)
            .run();
    }
    for (const message of messages) {
        if (!plans.some((plan) => plan.id === message.planId)) continue;
        await env.PREP_DB.prepare(
            `INSERT INTO prep_message (id, user_id, plan_id, role, content, created_at)
             VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
        )
            .bind(message.id, userId, message.planId, message.role, message.content, message.createdAt)
            .run();
    }
    return readWorkspace(userId);
}

function failure(error: unknown) {
    if (error instanceof AuthUnavailableError) {
        return Response.json({ error: error.message }, { status: 503 });
    }
    console.error(
        JSON.stringify({ event: "prep_sync_error", message: error instanceof Error ? error.message : "unknown" }),
    );
    return Response.json({ error: "Workspace sync failed." }, { status: 500 });
}

export async function GET(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
        return Response.json(await readWorkspace(userId));
    } catch (error) {
        return failure(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
        if (Number(request.headers.get("content-length") ?? "0") > 512 * 1024) {
            return Response.json({ error: "Workspace is too large to sync." }, { status: 413 });
        }
        const parsed = SyncPayloadSchema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Workspace data is invalid." }, { status: 400 });
        return Response.json(await upsertWorkspace(userId, parsed.data));
    } catch (error) {
        return failure(error);
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
        const env = getPrepCloudflareEnv();
        await env.PREP_DB.batch([
            env.PREP_DB.prepare("DELETE FROM prep_message WHERE user_id = ?").bind(userId),
            env.PREP_DB.prepare("DELETE FROM prep_plan WHERE user_id = ?").bind(userId),
            env.PREP_DB.prepare("DELETE FROM prep_team WHERE user_id = ?").bind(userId),
        ]);
        return Response.json({ success: true });
    } catch (error) {
        return failure(error);
    }
}
