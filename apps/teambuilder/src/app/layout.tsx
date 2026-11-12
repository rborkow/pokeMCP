import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

// Cloudflare Web Analytics beacon token. Public by design (inlined into every
// page's HTML), so a hardcoded default is safe. Must NOT depend solely on
// .env.local: that file is gitignored, so builds from git worktrees or CI
// silently drop the beacon (this broke visitor analytics on 2026-06-10/11).
const CF_ANALYTICS_TOKEN =
    process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN ?? "760a922acb5c4ad0bb6726211198945f";

export const metadata: Metadata = {
    title: {
        default:
            "PokeMCP — Pokémon Champions VGC results, meta reports and the VGC Teambuilder connector",
        template: "%s | PokeMCP",
    },
    description:
        "Pokémon Champions tournament results and monthly meta reports, plus VGC Teambuilder, a connector that brings usage statistics and team checks into Claude and ChatGPT.",
    keywords: [
        "Pokemon",
        "tournament results",
        "competitive Pokemon",
        "Showdown",
        "VGC",
        "Champions",
        "meta report",
        "usage statistics",
        "MCP connector",
    ],
    authors: [{ name: "PokeMCP" }],
    creator: "PokeMCP",
    metadataBase: new URL("https://www.pokemcp.com"),
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://www.pokemcp.com",
        siteName: "PokeMCP",
        title: "PokeMCP — Pokémon Champions VGC results, meta reports and the VGC Teambuilder connector",
        description:
            "Pokémon Champions tournament results and monthly meta reports, plus VGC Teambuilder, a connector that brings usage statistics and team checks into Claude and ChatGPT.",
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: "PokeMCP",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "PokeMCP — Pokémon Champions VGC results, meta reports and the VGC Teambuilder connector",
        description:
            "Pokémon Champions tournament results and monthly meta reports, plus VGC Teambuilder, a connector that brings usage statistics and team checks into Claude and ChatGPT.",
        images: ["/og-image.png"],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    icons: {
        icon: "/favicon.ico",
        apple: "/apple-touch-icon.png",
    },
    manifest: "/manifest.webmanifest",
    alternates: {
        canonical: "https://www.pokemcp.com",
    },
};

// JSON-LD structured data for rich search results
const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PokeMCP",
    description:
        "Pokémon Champions tournament results and monthly meta reports, and the VGC Teambuilder connector for AI assistants.",
    url: "https://www.pokemcp.com",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
                {CF_ANALYTICS_TOKEN && (
                    <script
                        defer
                        src="https://static.cloudflareinsights.com/beacon.min.js"
                        data-cf-beacon={`{"token": "${CF_ANALYTICS_TOKEN}"}`}
                    />
                )}
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
            >
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
