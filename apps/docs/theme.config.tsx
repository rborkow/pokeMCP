import { type DocsThemeConfig, useConfig } from "nextra-theme-docs";
import React from "react";

const SITE_URL = "https://docs.pokemcp.com";
const DEFAULT_DESCRIPTION =
    "Documentation for PokeMCP, an MCP server for competitive Pokemon team building, validation, and strategic analysis.";

const config: DocsThemeConfig = {
    logo: <span style={{ fontWeight: 700, fontSize: "1.25rem" }}>PokeMCP</span>,
    project: {
        link: "https://github.com/rborkow/pokeMCP",
    },
    docsRepositoryBase: "https://github.com/rborkow/pokeMCP/tree/main/apps/docs",
    head: function Head() {
        const { title, frontMatter } = useConfig();
        const pageTitle = title ? `${title} – PokeMCP Docs` : "PokeMCP Docs";
        const description =
            (frontMatter as { description?: string }).description || DEFAULT_DESCRIPTION;

        return (
            <>
                <title>{pageTitle}</title>
                <meta name="description" content={description} />

                {/* Open Graph */}
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={description} />
                <meta property="og:url" content={SITE_URL} />
                <meta property="og:site_name" content="PokeMCP Docs" />
                <meta property="og:type" content="website" />
                <meta property="og:image" content={`${SITE_URL}/og-image.png`} />

                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={pageTitle} />
                <meta name="twitter:description" content={description} />
                <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />

                {/* Favicon */}
                <link rel="icon" href="/favicon.ico" />
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
            </>
        );
    },
    footer: {
        component: <span>MIT {new Date().getFullYear()} © PokeMCP</span>,
    },
};

export default config;
