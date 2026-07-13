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
        default: "PokeMCP Prep — Champions Tournament Preparation",
        template: "%s | PokeMCP Prep",
    },
    description:
        "Turn current Pokémon Champions tournament teams into a sourced matchup plan, Bring 4, lead options, opening lines, and a practice checklist.",
    keywords: [
        "Pokemon",
        "tournament prep",
        "competitive Pokemon",
        "Showdown",
        "VGC",
        "Champions",
        "matchup analysis",
        "team sheet",
    ],
    authors: [{ name: "PokeMCP" }],
    creator: "PokeMCP",
    metadataBase: new URL("https://www.pokemcp.com"),
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://www.pokemcp.com",
        siteName: "PokeMCP Prep",
        title: "PokeMCP Prep — Champions Tournament Preparation",
        description:
            "Study current Champions tournament teams and turn them into a matchup plan you can practice.",
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: "PokeMCP Prep",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "PokeMCP Prep — Champions Tournament Preparation",
        description:
            "Study current Champions tournament teams and turn them into a matchup plan you can practice.",
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
    "@type": "WebApplication",
    name: "PokeMCP Prep",
    description: "Pokémon Champions tournament preparation and matchup planning",
    url: "https://www.pokemcp.com",
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
    },
    featureList: ["Sourced tournament newsroom", "Bring 4 planning", "Lead planning", "Practice checklists", "Showdown import"],
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
