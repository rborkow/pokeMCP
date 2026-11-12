import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Liveness only. The site no longer calls an AI provider, so there are no
// gateway secrets to report (see scripts/verify-deploy.sh).
export function GET() {
    return NextResponse.json(
        { node_env: process.env.NODE_ENV ?? "unknown" },
        { headers: { "Cache-Control": "no-store" } },
    );
}
