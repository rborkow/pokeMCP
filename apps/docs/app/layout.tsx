import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import type { ReactNode } from "react";

export const metadata = {
    title: {
        default: "PokeMCP Docs",
        template: "%s – PokeMCP Docs",
    },
    description:
        "Documentation for PokeMCP, an MCP server for competitive Pokemon team building, validation, and strategic analysis.",
    metadataBase: new URL("https://docs.pokemcp.com"),
    openGraph: {
        title: "PokeMCP Docs",
        description:
            "Documentation for PokeMCP, an MCP server for competitive Pokemon team building, validation, and strategic analysis.",
        url: "https://docs.pokemcp.com",
        siteName: "PokeMCP Docs",
        type: "website",
        images: ["/og-image.png"],
    },
    twitter: {
        card: "summary_large_image" as const,
        title: "PokeMCP Docs",
        description:
            "Documentation for PokeMCP, an MCP server for competitive Pokemon team building, validation, and strategic analysis.",
        images: ["/og-image.png"],
    },
    icons: {
        icon: "/favicon.ico",
        apple: "/apple-touch-icon.png",
    },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
    const pageMap = await getPageMap();
    return (
        <html lang="en" dir="ltr" suppressHydrationWarning>
            <Head />
            <body>
                <Layout
                    pageMap={pageMap}
                    docsRepositoryBase="https://github.com/rborkow/pokeMCP/tree/main/apps/docs"
                    navbar={
                        <Navbar
                            logo={
                                <span style={{ fontWeight: 700, fontSize: "1.25rem" }}>
                                    PokeMCP
                                </span>
                            }
                            projectLink="https://github.com/rborkow/pokeMCP"
                        />
                    }
                    footer={<Footer>MIT {new Date().getFullYear()} © PokeMCP</Footer>}
                >
                    {children}
                </Layout>
            </body>
        </html>
    );
}
