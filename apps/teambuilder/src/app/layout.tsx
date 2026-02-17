import type { Metadata } from "next";
import { Exo_2, Geist, Geist_Mono } from "next/font/google";
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

const exo2 = Exo_2({
	variable: "--font-exo2",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
	title: {
		default: "PokeMCP Team Builder - AI Pokemon Team Building",
		template: "%s | PokeMCP Team Builder",
	},
	description:
		"Build competitive Pokemon teams with AI assistance. Get real-time meta analysis, threat matrix, type coverage, and export to Pokemon Showdown. Supports Gen 9 OU, VGC, and more formats.",
	keywords: [
		"Pokemon",
		"team builder",
		"competitive Pokemon",
		"Showdown",
		"VGC",
		"OU",
		"meta analysis",
		"AI",
		"type coverage",
		"threat matrix",
	],
	authors: [{ name: "PokeMCP" }],
	creator: "PokeMCP",
	metadataBase: new URL("https://www.pokemcp.com"),
	openGraph: {
		type: "website",
		locale: "en_US",
		url: "https://www.pokemcp.com",
		siteName: "PokeMCP Team Builder",
		title: "PokeMCP Team Builder - AI Pokemon Team Building",
		description:
			"Build competitive Pokemon teams with AI assistance. Real-time meta analysis, threat matrix, and Showdown export.",
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "PokeMCP Team Builder",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "PokeMCP Team Builder - AI Pokemon Team Building",
		description:
			"Build competitive Pokemon teams with AI assistance. Real-time meta analysis and Showdown export.",
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
	alternates: {
		canonical: "https://www.pokemcp.com",
	},
};

// JSON-LD structured data for rich search results
const jsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "PokeMCP Team Builder",
	description:
		"AI-powered Pokemon competitive team builder with Showdown integration",
	url: "https://www.pokemcp.com",
	applicationCategory: "GameApplication",
	operatingSystem: "Any",
	offers: {
		"@type": "Offer",
		price: "0",
		priceCurrency: "USD",
	},
	featureList: [
		"AI-powered team suggestions",
		"Type coverage analysis",
		"Threat matrix vs meta Pokemon",
		"Pokemon Showdown import/export",
		"Support for Gen 9 OU, VGC, and 15+ formats",
	],
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
				{process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN && (
					<script
						defer
						src="https://static.cloudflareinsights.com/beacon.min.js"
						data-cf-beacon={`{"token": "${process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN}"}`}
					/>
				)}
			</head>
			<body
				className={`${geistSans.variable} ${geistMono.variable} ${exo2.variable} antialiased min-h-screen bg-background`}
			>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
