import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";
import { generateBattleCard } from "@/lib/prep/battle-card";
import { GeneratePrepRequestSchema } from "@/lib/prep/schema";

interface PrepEnv {
    PREP_RATE_LIMITER?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
}

export async function POST(request: NextRequest) {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 96 * 1024) {
        return Response.json({ error: "Prep request is too large." }, { status: 413 });
    }

    try {
        const env = getCloudflareContext().env as PrepEnv;
        const rateKey = request.headers.get("x-prep-workspace") ?? "anonymous";
        if (env.PREP_RATE_LIMITER) {
            const { success } = await env.PREP_RATE_LIMITER.limit({ key: `generate:${rateKey}` });
            if (!success) {
                return Response.json(
                    { error: "Too many prep requests. Wait a minute and try again." },
                    { status: 429, headers: { "Retry-After": "60" } },
                );
            }
        }
    } catch {
        // next dev does not expose Cloudflare bindings; validation still protects the route locally.
    }

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return Response.json({ error: "Request body must be JSON." }, { status: 400 });
    }

    const parsed = GeneratePrepRequestSchema.safeParse(payload);
    if (!parsed.success) {
        return Response.json(
            { error: "Both teams must contain valid Champions team-sheet data.", issues: parsed.error.issues },
            { status: 400 },
        );
    }

    return Response.json({
        battleCard: generateBattleCard(parsed.data.ownTeam, parsed.data.opponentTeam),
    });
}
