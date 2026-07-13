import { getCloudflareContext } from "@opennextjs/cloudflare";

async function actorKey(request: Request) {
    const workspace = request.headers.get("x-prep-workspace");
    if (workspace) return workspace.slice(0, 80);
    const address =
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "anonymous";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
    return Array.from(new Uint8Array(digest).slice(0, 12), (byte) =>
        byte.toString(16).padStart(2, "0"),
    ).join("");
}

export async function enforceAiRateLimit(request: Request, bucket: string) {
    try {
        const env = getCloudflareContext().env as CloudflareEnv;
        const { success } = await env.PREP_RATE_LIMITER.limit({
            key: `${bucket}:${await actorKey(request)}`,
        });
        if (!success) {
            return Response.json(
                { error: "Too many requests. Wait a minute and try again." },
                { status: 429, headers: { "Retry-After": "60" } },
            );
        }
    } catch {
        // next dev has no Cloudflare binding; production always does.
    }
    return null;
}
