// Augments the Env interface with runtime secrets set via `wrangler secret put`
// (not emitted by `wrangler types`) and the typed ingestion coordinator binding.
declare namespace Cloudflare {
    interface Env {
        CLOUDFLARE_API_TOKEN?: string;
        CLOUDFLARE_ACCOUNT_ID?: string;
        CF_ACCESS_TEAM_DOMAIN?: string;
        LIMITLESS_API_KEY?: string;
        INGESTION_COORDINATOR: DurableObjectNamespace<
            import("./ingestion/coordinator.js").IngestionCoordinator
        >;
    }
}

// Wrangler 4.110 emits the global Env interface directly from a private base
// interface. Keep secret-only bindings available on that generated interface.
interface Env extends Cloudflare.Env {}
