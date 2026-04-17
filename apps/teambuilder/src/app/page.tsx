"use client";

import { AlertTriangle, History, Shield, Zap } from "lucide-react";
import { Suspense, useCallback } from "react";
import { SpeedTiers } from "@/components/analysis/SpeedTiers";
import { ThreatMatrix } from "@/components/analysis/ThreatMatrix";
import { TypeCoverage } from "@/components/analysis/TypeCoverage";
import { VGCTeamWarnings } from "@/components/analysis/VGCTeamWarnings";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { TeamHistory } from "@/components/history/TeamHistory";
import { Header } from "@/components/layout/Header";
import { TeamGrid } from "@/components/team/TeamGrid";
import { TeamImportExport } from "@/components/team/TeamImportExport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WelcomeOverlay } from "@/components/welcome/WelcomeOverlay";
import { useUrlTeam } from "@/hooks/useUrlTeam";
import { getArchetypePrompt, type TeamArchetype } from "@/lib/ai/archetypes";
import { useChatStore } from "@/stores/chat-store";
import { useTeamStore } from "@/stores/team-store";
import { FORMATS, getFormatDisplayName, isChampionsFormat } from "@/types/pokemon";

function UrlTeamLoader() {
    useUrlTeam();
    return null;
}

export default function Home() {
    const { team, format } = useTeamStore();
    const { queuePrompt } = useChatStore();

    const handleGenerate = useCallback(
        (archetype?: TeamArchetype) => {
            const prompt = archetype
                ? getArchetypePrompt(archetype.id, format)
                : `Build me a competitive 6 Pokemon team for ${format.toUpperCase()}. Pick an archetype that's strong in the current meta (hyper offense, bulky offense, balance, weather, etc.) and explain your strategy. For each Pokemon, use the modify_team tool with full competitive sets including EVs, nature, and tera type.`;
            queuePrompt(prompt);
        },
        [queuePrompt, format],
    );

    const handleBuildOwn = useCallback(() => {
        // Just dismiss the overlay - user can click on any empty slot
    }, []);

    return (
        <div className="min-h-screen flex flex-col">
            {/* Load team from URL if present */}
            <Suspense fallback={null}>
                <UrlTeamLoader />
            </Suspense>

            {/* Welcome overlay for empty team */}
            <WelcomeOverlay onGenerate={handleGenerate} onBuildOwn={handleBuildOwn} />

            {/* Background decoration */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
                <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-secondary/5 via-transparent to-transparent rounded-full blur-3xl" />
            </div>

            <Header />

            <main className="relative flex-1 container max-w-screen-2xl px-4 py-6 md:py-8">
                {/* Team Section */}
                <section className="space-y-4 mb-10 md:mb-12">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-display font-bold">
                                <span className="text-gradient">Your Team</span>
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
                        <TeamImportExport />
                    </div>

                    <TeamGrid />

                    {/* VGC-specific warnings */}
                    <VGCTeamWarnings />
                </section>

                {/* Two-column layout: Analysis + Chat side by side on desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
                    {/* Team Grid + Analysis */}
                    <div className="lg:col-span-3">
                        <h2 className="sr-only">Team Analysis</h2>
                        <ErrorBoundary level="section">
                            {/* Analysis Tabs */}
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

                    {/* AI Assistant Panel */}
                    <div className="lg:col-span-2">
                        <h2 className="sr-only">AI Coach</h2>
                        <ErrorBoundary level="section">
                            <ChatPanel />
                        </ErrorBoundary>
                    </div>
                </div>
            </main>

            {/* Floating feedback button */}
            <FeedbackButton />

            {/* Footer */}
            <footer className="border-t py-6 mt-12">
                <div className="container max-w-screen-2xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
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
            </footer>
        </div>
    );
}
