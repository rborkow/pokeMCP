/**
 * Runtime bindings for the pokemonitor Worker.
 *
 * `vars` come from wrangler.jsonc; secrets are set via `wrangler secret put`
 * (or .dev.vars locally). R2 buckets are declared in wrangler.jsonc.
 */
declare global {
    interface Env {
        // --- vars (wrangler.jsonc) ---
        ENVIRONMENT: string;
        CLOUDFLARE_ACCOUNT_ID: string;
        ANALYTICS_DATASET: string;
        CF_ANALYTICS_SITE_TAG: string;
        WORKER_SCRIPTS: string;
        AI_GATEWAY_ID?: string;
        REPORT_EMAIL_TO: string;
        REPORT_EMAIL_FROM: string;

        // --- secrets ---
        CLOUDFLARE_API_TOKEN?: string;
        ANTHROPIC_API_KEY?: string;
        RESEND_API_KEY?: string;
        CF_ACCESS_TEAM_DOMAIN?: string;
        CF_AIG_TOKEN?: string;
        CLOUDFLARE_AI_GATEWAY_URL?: string;
        REPORT_RUN_TOKEN?: string;

        // --- R2 buckets ---
        INTERACTION_LOGS?: R2Bucket;
        REPORTS: R2Bucket;
    }
}

export {};
