import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { DEFAULT_CHAMPIONS_FORMAT } from "@/lib/prep/capabilities";

const EventSchema = z.object({
    event: z.enum([
        "newsroom_view",
        "event_team_selected",
        "prep_started",
        "prep_generated",
        "plan_exported",
        "coach_followup",
    ]),
    format: z.string().max(40).optional(),
    source: z.string().max(40).optional(),
    value: z.number().finite().optional(),
});

export async function POST(request: Request) {
    if (Number(request.headers.get("content-length") ?? "0") > 4_096) {
        return new Response(null, { status: 413 });
    }
    try {
        const parsed = EventSchema.safeParse(await request.json());
        if (!parsed.success) return new Response(null, { status: 400 });
        const env = getCloudflareContext().env as CloudflareEnv;
        env.ANALYTICS.writeDataPoint({
            indexes: ["prep_event"],
            blobs: [parsed.data.event, parsed.data.format ?? DEFAULT_CHAMPIONS_FORMAT, parsed.data.source ?? "web"],
            doubles: [parsed.data.value ?? 1],
        });
        return new Response(null, { status: 204 });
    } catch {
        return new Response(null, { status: 204 });
    }
}
