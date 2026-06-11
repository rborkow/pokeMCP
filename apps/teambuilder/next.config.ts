import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import remarkGfm from "remark-gfm";

const nextConfig: NextConfig = {
    pageExtensions: ["ts", "tsx", "mdx"],
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
