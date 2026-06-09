"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { Header } from "@/components/layout/Header";
import { LegalAttribution } from "@/components/layout/LegalAttribution";
import { SystemLogBridge } from "@/components/providers/SystemLogBridge";
import { useUrlTeam } from "@/hooks/useUrlTeam";

// Render the builder client-only. Its component tree statically pulls in the
// full Pokédex (`pokemon-data-generated`, ~365KB) for type/stat/speed analysis;
// SSRing it inlined that table into the /builder server bundle and dominated
// cold-start CPU (p99 ~690ms). /builder has no useful SSR anyway — the team is
// hydrated from localStorage — so deferring to the client removes the dex from
// the worker cold-start path at no UX cost beyond a brief skeleton.
const BuilderLayout = dynamic(
    () => import("@/components/builder/BuilderLayout").then((m) => m.BuilderLayout),
    {
        ssr: false,
        loading: () => (
            <div
                className="flex-1 flex items-center justify-center py-24"
                role="status"
                aria-busy="true"
                aria-label="Loading team builder"
            >
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-hairline-strong border-t-transparent" />
            </div>
        ),
    },
);

function UrlTeamLoader() {
    useUrlTeam();
    return null;
}

export default function BuilderPage() {
    return (
        <div className="min-h-screen flex flex-col">
            <Suspense fallback={null}>
                <UrlTeamLoader />
            </Suspense>

            <SystemLogBridge />

            <Suspense fallback={null}>
                <Header />
            </Suspense>

            <Suspense fallback={null}>
                <BuilderLayout />
            </Suspense>

            <FeedbackButton />

            <footer className="border-t py-6 mt-12">
                <div className="container max-w-screen-2xl px-4 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
                        <span>PokeMCP Team Builder</span>
                        <nav aria-label="Footer" className="flex items-center gap-4">
                            <a
                                href="https://docs.pokemcp.com"
                                className="hover:text-foreground transition-colors"
                            >
                                Documentation
                            </a>
                            <a
                                href="https://api.pokemcp.com"
                                className="hover:text-foreground transition-colors"
                            >
                                API
                            </a>
                            <a
                                href="https://github.com/rborkow/pokeMCP"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground transition-colors"
                            >
                                GitHub
                                <span className="sr-only">(opens in new tab)</span>
                            </a>
                        </nav>
                    </div>
                    <LegalAttribution />
                </div>
            </footer>
        </div>
    );
}
