import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PrepSetupForm, type SelectedOpponent } from "@/components/prep/PrepSetupForm";
import { PrepHeader } from "@/components/prep/PrepHeader";
import { getEventForRequest } from "@/lib/live-events";
import { eventOpponentSource, eventPlacingToSnapshot } from "@/lib/prep/event-team";

export const metadata = {
    title: "New matchup plan",
    description: "Combine your Champions team with an opposing team and create a practice-ready battle card.",
};

export default async function NewPrepPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const query = await searchParams;
    const eventSlug = typeof query.event === "string" ? query.event : undefined;
    const placingValue = typeof query.placing === "string" ? Number(query.placing) : undefined;
    let selectedOpponent: SelectedOpponent | undefined;

    if (eventSlug && placingValue) {
        const event = await getEventForRequest(eventSlug);
        const placing = event?.topCut.find((entry) => entry.placing === placingValue);
        if (event && placing) {
            selectedOpponent = {
                team: eventPlacingToSnapshot(event, placing),
                source: eventOpponentSource(event, placing),
            };
        }
    }

    return (
        <div className="min-h-screen">
            <PrepHeader />
            <main className="prep-shell pb-20 pt-10">
                <Link href={eventSlug ? `/events/${eventSlug}` : "/"} className="prep-text-link"><ArrowLeft className="h-4 w-4" /> Back</Link>
                <header className="max-w-3xl pb-10 pt-8">
                    <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Prepare one matchup</h1>
                    <p className="mt-4 text-pretty leading-7 text-muted-foreground">Use the information you actually have. The battle card separates published facts, calculations, coaching suggestions, and incomplete Champions mechanics.</p>
                </header>
                <PrepSetupForm selectedOpponent={selectedOpponent} />
            </main>
        </div>
    );
}
