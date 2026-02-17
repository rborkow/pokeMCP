import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "PokeMCP Team Builder",
		short_name: "PokeMCP",
		description:
			"AI-powered competitive Pokemon team builder with Showdown integration",
		start_url: "/",
		display: "standalone",
		background_color: "#0a0a0a",
		theme_color: "#ef4444",
		icons: [
			{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
			{ src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
		],
	};
}
