let logged = false;

export function logGatewayHealthOnce(source: string): void {
    if (logged) return;
    logged = true;
    console.log(
        JSON.stringify({
            event: "ai_gateway_health",
            source,
            node_env: process.env.NODE_ENV ?? "unknown",
            gateway: {
                cloudflare_ai_gateway_url: Boolean(process.env.CLOUDFLARE_AI_GATEWAY_URL),
                cf_aig_token: Boolean(process.env.CF_AIG_TOKEN),
                anthropic_api_key: Boolean(process.env.ANTHROPIC_API_KEY),
            },
        }),
    );
}
