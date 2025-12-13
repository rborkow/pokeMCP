"use client";

import { Header } from "@/components/layout/Header";
import { TeamGrid } from "@/components/team/TeamGrid";
import { TeamImportExport } from "@/components/team/TeamImportExport";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { TypeCoverage } from "@/components/analysis/TypeCoverage";
import { ThreatMatrix } from "@/components/analysis/ThreatMatrix";
import { TeamHistory } from "@/components/history/TeamHistory";
import { useTeamStore } from "@/stores/team-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const { team, format } = useTeamStore();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container max-w-screen-2xl px-4 py-6">
        {/* Team Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Your Team</h1>
              <p className="text-sm text-muted-foreground">
                {team.length}/6 Pokemon • {format.toUpperCase()}
              </p>
            </div>
            <TeamImportExport />
          </div>

          <TeamGrid />
        </section>

        {/* Analysis Section */}
        <section className="mt-8 space-y-4">
          <Tabs defaultValue="coverage" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="coverage">Coverage</TabsTrigger>
              <TabsTrigger value="threats">Threats</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
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
        </section>

        {/* Chat Section */}
        <section className="mt-8 space-y-4">
          <h2 className="text-xl font-bold">AI Assistant</h2>
          <ChatPanel />
        </section>
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
