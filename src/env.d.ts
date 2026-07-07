// Augments the Env interface with runtime secrets set via `wrangler secret put`
// (not emitted by `wrangler types` because they live outside wrangler.jsonc) and
// bindings added since the last worker-configuration.d.ts regeneration.
declare namespace Cloudflare {
    interface Env {
        CLOUDFLARE_API_TOKEN?: string;
        CLOUDFLARE_ACCOUNT_ID?: string;
        CF_ACCESS_TEAM_DOMAIN?: string;
        // Durable Object driving the weekly RAG ingestion alarm chain
        // (declared in wrangler.jsonc; typed here to avoid regenerating
        // worker-configuration.d.ts).
        INGESTION_COORDINATOR: DurableObjectNamespace<
            import("./ingestion/coordinator.js").IngestionCoordinator
        >;
    }
}
