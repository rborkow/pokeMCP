import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import remarkGfm from "remark-gfm";

const nextConfig: NextConfig = {
    pageExtensions: ["ts", "tsx", "mdx"],
    async redirects() {
        return [
            // PokeMCP Prep, saved teams, accounts and the team builder are
            // retired. Their addresses lead to one notice page, which also
            // lets a visitor download what their browser still holds.
            { source: "/prep/:path*", destination: "/retired", permanent: false },
            { source: "/teams", destination: "/retired", permanent: false },
            { source: "/account", destination: "/retired", permanent: false },
            { source: "/builder", destination: "/retired", permanent: false },
            { source: "/build", destination: "/retired", permanent: false },
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
