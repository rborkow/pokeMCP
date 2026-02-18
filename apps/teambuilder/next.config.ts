import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    // Environment variables
    env: {
        NEXT_PUBLIC_MCP_URL: process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com",
    },
};

export default nextConfig;
