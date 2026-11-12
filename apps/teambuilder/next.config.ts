import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import remarkGfm from "remark-gfm";

const nextConfig: NextConfig = {
    pageExtensions: ["ts", "tsx", "mdx"],
    async redirects() {
        return [
            // The team builder is gone. `/build` was linked from reports and
            // the sitemap but never shipped (its page was caught by a `build/`
            // ignore rule), so both old addresses lead home, not to a 404.
            { source: "/builder", destination: "/", permanent: false },
            { source: "/build", destination: "/", permanent: false },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "raw.githubusercontent.com",
                pathname: "/PokeAPI/sprites/**",
            },
            {
                protocol: "https",
                hostname: "play.pokemonshowdown.com",
                pathname: "/sprites/**",
            },
        ],
    },
};

// remark-gfm enables pipe tables — the load-bearing feature for reports, whose
// usage tables must land in raw HTML for AI crawlers (no JS execution).
const withMDX = createMDX({
    options: {
        remarkPlugins: [remarkGfm],
    },
});

export default withMDX(nextConfig);
