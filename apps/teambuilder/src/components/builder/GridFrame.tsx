"use client";

import { AlertTriangle, History, Shield, Zap } from "lucide-react";
import { SpeedTiers } from "@/components/analysis/SpeedTiers";
import { ThreatMatrix } from "@/components/analysis/ThreatMatrix";
import { TypeCoverage } from "@/components/analysis/TypeCoverage";
import { VGCTeamWarnings } from "@/components/analysis/VGCTeamWarnings";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { TeamHistory } from "@/components/history/TeamHistory";
import { TeamGrid } from "@/components/team/TeamGrid";
import { TeamImportExport } from "@/components/team/TeamImportExport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTeamStore } from "@/stores/team-store";
import { FORMATS, getFormatDisplayName, isChampionsFormat } from "@/types/pokemon";

export interface GridFrameProps {
    defaultImportOpen?: boolean;
}

/**
 * Grid-mode builder — the pre-v2 layout preserved as the power-user escape
 * hatch. Rendered when `?mode=grid` (or team-store.uiMode === "grid"). The
 * v1 WelcomeOverlay is retired; users drop into the grid and interact
 * directly with empty slots.
 */
export function GridFrame({ defaultImportOpen }: GridFrameProps = {}) {
    const { team, format } = useTeamStore();

    return (
        <>
            <main className="relative flex-1 container max-w-screen-2xl px-4 py-6 md:py-8">
                <section className="space-y-4 mb-10 md:mb-12">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                                Your team
                            </h1>
                            <p className="text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-foreground">
                                    {team.length}/6
                                </span>{" "}
                                Pokemon
                                <span className="text-muted-foreground/50">-</span>
                                <span className="px-2 py-0.5 rounded bg-muted text-xs font-medium tracking-wider">
                                    {getFormatDisplayName(format)}
                                </span>
                                {isChampionsFormat(format) && (
                                    <span
                                        title="Pokémon Champions regulation. Mega Evolution and Victory Point mechanics are only partially supported."
                                        className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 text-[11px] font-semibold uppercase tracking-wider border border-amber-500/30"
                                    >
                                        {FORMATS.find((f) => f.id === format)?.chipLabel ??
                                            "Champions"}
                                    </span>
                                )}
                            </p>
                        </div>
                        <TeamImportExport defaultImportOpen={defaultImportOpen} />
                    </div>

                    <TeamGrid />

                    <VGCTeamWarnings />
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
                    <div className="lg:col-span-3">
                        <h2 className="sr-only">Team Analysis</h2>
                        <ErrorBoundary level="section">
                            <Tabs defaultValue="threats" className="w-full">
                                <TabsList className="bg-muted/50 border border-border w-full justify-start">
                                    <TabsTrigger
                                        value="coverage"
                                        className="gap-2 data-[state=active]:bg-card data-[state=active]:text-primary"
                                    >
                                        <Shield className="w-4 h-4" />
                                        Coverage
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="threats"
                                        className="gap-2 data-[state=active]:bg-card data-[state=active]:text-primary"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                        Threats
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="speed"
                                        className="gap-2 data-[state=active]:bg-card data-[state=active]:text-primary"
                                    >
                                        <Zap className="w-4 h-4" />
                                        Speed
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="history"
                                        className="gap-2 data-[state=active]:bg-card data-[state=active]:text-primary"
                                    >
                                        <History className="w-4 h-4" />
                                        History
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="coverage" className="mt-5">
                                    <TypeCoverage />
                                </TabsContent>
                                <TabsContent value="threats" className="mt-5">
                                    <ThreatMatrix />
                                </TabsContent>
                                <TabsContent value="speed" className="mt-5">
                                    <SpeedTiers />
                                </TabsContent>
                                <TabsContent value="history" className="mt-5">
                                    <TeamHistory />
                                </TabsContent>
                            </Tabs>
                        </ErrorBoundary>
                    </div>

                    <div className="lg:col-span-2">
                        <h2 className="sr-only">AI Coach</h2>
                        <ErrorBoundary level="section">
                            <ChatPanel />
                        </ErrorBoundary>
                    </div>
                </div>
            </main>
        </>
    );
}
