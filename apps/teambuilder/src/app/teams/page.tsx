import { PrepHeader } from "@/components/prep/PrepHeader";
import { TeamsWorkspace } from "@/components/prep/TeamsWorkspace";

export const metadata = { title: "Teams and prep plans" };

export default function TeamsPage() {
    return (
        <div className="min-h-screen">
            <PrepHeader />
            <main className="prep-shell pb-20 pt-10">
                <header className="border-b border-border pb-8">
                    <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Your prep workspace</h1>
                    <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">Keep team snapshots, revisit matchup plans, and export a local backup. An account is optional.</p>
                </header>
                <div className="pt-10"><TeamsWorkspace /></div>
            </main>
        </div>
    );
}
