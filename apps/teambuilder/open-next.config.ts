import type { OpenNextConfig } from "@opennextjs/cloudflare";

export default {
    default: {
        override: {
            wrapper: "cloudflare-node",
            converter: "edge",
            proxyExternalRequest: "fetch",
            // Read-only cache backed by Workers static assets: serves the
            // build-time prerenders (reports, /pokemon/* trend pages) as plain
            // HTML without re-rendering. No revalidation — pages update only on
            // deploy, which is exactly how the monthly report pipeline works.
            incrementalCache: () =>
                import(
                    "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache"
                ).then((m) => m.default),
            tagCache: "dummy",
            queue: "dummy",
        },
    },
    edgeExternals: ["node:crypto"],
    middleware: {
        external: true,
        override: {
            wrapper: "cloudflare-edge",
            converter: "edge",
            proxyExternalRequest: "fetch",
            incrementalCache: "dummy",
            tagCache: "dummy",
            queue: "dummy",
        },
    },
} satisfies OpenNextConfig;
