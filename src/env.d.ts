// Augments the Env interface with runtime secrets set via `wrangler secret put`.
// These are not emitted by `wrangler types` because they live outside wrangler.jsonc.
declare namespace Cloudflare {
    interface Env {
        ANTHROPIC_API_KEY?: string;
        CLOUDFLARE_API_TOKEN?: string;
        CLOUDFLARE_ACCOUNT_ID?: string;
        CF_ACCESS_TEAM_DOMAIN?: string;
        CF_AIG_TOKEN?: string;
    }
}
