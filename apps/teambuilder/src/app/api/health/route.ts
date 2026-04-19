import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
    return NextResponse.json(
        {
            node_env: process.env.NODE_ENV ?? "unknown",
            gateway: {
                cloudflare_ai_gateway_url: Boolean(process.env.CLOUDFLARE_AI_GATEWAY_URL),
                cf_aig_token: Boolean(process.env.CF_AIG_TOKEN),
                anthropic_api_key: Boolean(process.env.ANTHROPIC_API_KEY),
            },
        },
        { headers: { "Cache-Control": "no-store" } },
    );
}
