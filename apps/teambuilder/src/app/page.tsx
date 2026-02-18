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
import { getFormatDisplayName } from "@/types/pokemon";

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

            <main className="relative flex-1 container max-w-screen-2xl px-4 py-6 md:py-10">
                {/* Team Section */}
                <section className="space-y-4 mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-display font-bold">
                                <span className="text-gradient">Your Team</span>
                            </h1>
                            <p className="text-muted-foreground mt-1 flex items-center gap-2">
                                <span className="font-semibold text-foreground">
                                    {team.length}/6
                                </span>{" "}
                                Pokemon
                                <span className="text-muted-foreground/50">-</span>
                                <span className="px-2 py-0.5 rounded bg-muted text-xs font-medium tracking-wider">
                                    {getFormatDisplayName(format)}
                                </span>
                            </p>
                        </div>
                        <TeamImportExport />
                    </div>

                    <TeamGrid />

                    {/* VGC-specific warnings */}
                    <VGCTeamWarnings />
                </section>

                {/* Two-column layout: Analysis + Chat side by side on desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Team Grid + Analysis */}
                    <div className="lg:col-span-2">
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

                                <TabsContent value="coverage" className="mt-4">
                                    <TypeCoverage />
                                </TabsContent>

                                <TabsContent value="threats" className="mt-4">
                                    <ThreatMatrix />
                                </TabsContent>

                                <TabsContent value="speed" className="mt-4">
                                    <SpeedTiers />
                                </TabsContent>

                                <TabsContent value="history" className="mt-4">
                                    <TeamHistory />
                                </TabsContent>
                            </Tabs>
                        </ErrorBoundary>
                    </div>

                    {/* AI Assistant Panel */}
                    <div className="lg:col-span-1">
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
            <footer className="border-t py-4 mt-8">
                <div className="container max-w-screen-2xl px-4 text-center text-sm text-muted-foreground">
                    <span>PokeMCP Team Builder</span>
                    <nav aria-label="Footer" className="inline">
                        {" \u2022 "}
                        <a
                            href="https://docs.pokemcp.com"
                            className="underline hover:text-foreground py-2 inline-block"
                        >
                            Documentation
                        </a>
                        {" \u2022 "}
                        <a
                            href="https://api.pokemcp.com"
                            className="underline hover:text-foreground py-2 inline-block"
                        >
                            API
                        </a>
                        {" \u2022 "}
                        <a
                            href="https://github.com/rborkow/pokeMCP"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-foreground py-2 inline-block"
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
