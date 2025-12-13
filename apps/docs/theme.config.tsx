import React from 'react';
import type { DocsThemeConfig } from 'nextra-theme-docs';

const config: DocsThemeConfig = {
    logo: <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>🎮 PokéMCP</span>,
    project: {
        link: 'https://github.com/rborkow/pokeMCP',
    },
    docsRepositoryBase: 'https://github.com/rborkow/pokeMCP/tree/main/apps/docs',
    footer: {
        component: <span>MIT {new Date().getFullYear()} © PokéMCP</span>,
    },
};

export default config;
