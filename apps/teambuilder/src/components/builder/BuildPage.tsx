"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense } from "react";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { Header } from "@/components/layout/Header";
import { LegalAttribution } from "@/components/layout/LegalAttribution";
import { SystemLogBridge } from "@/components/providers/SystemLogBridge";
import { useUrlTeam } from "@/hooks/useUrlTeam";

const BuilderLayout = dynamic(
    () => import("@/components/builder/BuilderLayout").then((module) => module.BuilderLayout),
    {
        ssr: false,
        loading: () => (
            <div className="flex flex-1 items-center justify-center py-24" role="status" aria-busy="true" aria-label="Loading team builder">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent" />
            </div>
        ),
    },
);

function UrlTeamLoader() {
    useUrlTeam();
    return null;
}

export function BuildPage() {
    return (
        <div className="flex min-h-screen flex-col">
            <Suspense fallback={null}><UrlTeamLoader /></Suspense>
            <SystemLogBridge />
            <Suspense fallback={null}><Header /></Suspense>
            <Suspense fallback={null}><BuilderLayout /></Suspense>
            <FeedbackButton />
            <footer className="mt-12 border-t border-border py-6">
                <div className="prep-shell flex flex-col gap-4">
                    <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
                        <span>PokeMCP Prep · Team builder</span>
                        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-4">
                            <Link href="/" className="hover:text-foreground">Newsroom</Link>
                            <Link href="/prep/new" className="hover:text-foreground">New prep</Link>
                            <a href="https://github.com/rborkow/pokeMCP" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub<span className="sr-only"> (opens in new tab)</span></a>
                        </nav>
                    </div>
                    <LegalAttribution />
                </div>
            </footer>
        </div>
    );
}
