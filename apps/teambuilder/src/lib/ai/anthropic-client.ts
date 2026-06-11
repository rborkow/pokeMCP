import Anthropic from "@anthropic-ai/sdk";

export type GatewaySource = "web" | "interview" | "report";

/**
 * Construct an Anthropic SDK client that routes through the Cloudflare AI
 * Gateway. In production, refuses to fall back to direct `api.anthropic.com`
 * so misconfigurations can't silently skip gateway observability.
 */
export function createAnthropicClient(source: GatewaySource): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

    const gatewayUrl = process.env.CLOUDFLARE_AI_GATEWAY_URL;
    const gatewayToken = process.env.CF_AIG_TOKEN;

    assertGatewayConfiguredInProduction(gatewayUrl);

    if (!gatewayUrl) {
        return new Anthropic({ apiKey });
    }

    return new Anthropic({
        apiKey,
        baseURL: gatewayUrl,
        defaultHeaders: {
            ...(gatewayToken && {
                "cf-aig-authorization": `Bearer ${gatewayToken}`,
            }),
            "cf-aig-metadata": JSON.stringify({ source }),
        },
    });
}

function assertGatewayConfiguredInProduction(gatewayUrl: string | undefined) {
    if (gatewayUrl) return;
    if (process.env.NODE_ENV !== "production") return;
    throw new Error(
        "CLOUDFLARE_AI_GATEWAY_URL is required in production — refusing to bypass the AI Gateway",
    );
}
