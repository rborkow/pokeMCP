"use client";

import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { TeamGrid } from "@/components/team/TeamGrid";
import { TeamImportExport } from "@/components/team/TeamImportExport";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { TypeCoverage } from "@/components/analysis/TypeCoverage";
import { ThreatMatrix } from "@/components/analysis/ThreatMatrix";
import { TeamHistory } from "@/components/history/TeamHistory";
import { useTeamStore } from "@/stores/team-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, AlertTriangle, History } from "lucide-react";
import { useUrlTeam } from "@/hooks/useUrlTeam";

function UrlTeamLoader() {
  useUrlTeam();
  return null;
}

export default function Home() {
  const { team, format } = useTeamStore();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Load team from URL if present */}
      <Suspense fallback={null}>
        <UrlTeamLoader />
      </Suspense>

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
                <span className="font-semibold text-foreground">{team.length}/6</span> Pokemon
                <span className="text-muted-foreground/50">-</span>
                <span className="px-2 py-0.5 rounded bg-muted text-xs font-medium uppercase tracking-wider">
                  {format.toUpperCase()}
                </span>
              </p>
            </div>
            <TeamImportExport />
          </div>

          <TeamGrid />
        </section>

        {/* Two-column layout: Analysis + Chat side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Grid + Analysis */}
          <div className="lg:col-span-2">
            {/* Analysis Tabs */}
            <Tabs defaultValue="coverage" className="w-full">
              <TabsList className="bg-muted/50 border border-border w-full justify-start">
                <TabsTrigger value="coverage" className="gap-2 data-[state=active]:bg-card data-[state=active]:text-primary">
                  <Shield className="w-4 h-4" />
                  Coverage
                </TabsTrigger>
                <TabsTrigger value="threats" className="gap-2 data-[state=active]:bg-card data-[state=active]:text-primary">
                  <AlertTriangle className="w-4 h-4" />
                  Threats
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-card data-[state=active]:text-primary">
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

              <TabsContent value="history" className="mt-4">
                <TeamHistory />
              </TabsContent>
            </Tabs>
          </div>

          {/* AI Assistant Panel */}
          <div className="lg:col-span-1">
            <ChatPanel />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 mt-8">
        <div className="container max-w-screen-2xl px-4 text-center text-sm text-muted-foreground">
          <p>
            PokeMCP Team Builder •{" "}
            <a
              href="https://pokemcp.com"
              className="underline hover:text-foreground"
            >
              Documentation
            </a>{" "}
            •{" "}
            <a
              href="https://api.pokemcp.com"
              className="underline hover:text-foreground"
            >
              API
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
