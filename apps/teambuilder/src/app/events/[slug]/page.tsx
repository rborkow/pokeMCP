import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceBadge } from "@/components/site/EvidenceBadge";
import { PokemonLineup } from "@/components/site/PokemonLineup";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CONNECTOR_DOCS_URL } from "@/lib/connector";
import { eventPlacingToPokemon, getEventsIndex } from "@/lib/event-pages";
import { getEventForRequest } from "@/lib/live-events";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export function generateStaticParams() {
    return (getEventsIndex().champions ?? []).map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const event = await getEventForRequest(slug);
    if (!event) return { title: "Event not found" };
    return {
        title: `${event.name} teams and results`,
        description: `Published top-cut teams and placings from ${event.name}, a Pokémon Champions tournament.`,
        alternates: { canonical: `/events/${event.slug}` },
    };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const event = await getEventForRequest(slug);
    if (!event) notFound();

    return (
        <div className="min-h-screen">
            <SiteHeader />
            <main className="prep-shell pb-20 pt-10">
                <Link href="/" className="prep-text-link">
                    <ArrowLeft className="h-4 w-4" /> Back to results
                </Link>
                <header className="mt-8 border-b border-border pb-8">
                    <div className="mb-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs text-primary">
                            {event.regulationLabel}
                        </span>
                        <EvidenceBadge kind="tournament-source" label="Published event record" />
                    </div>
                    <h1 className="max-w-4xl text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                        {event.name}
                    </h1>
                    <p className="mt-4 text-sm text-muted-foreground">
                        {new Date(event.date).toLocaleDateString("en-US", {
                            dateStyle: "long",
                            timeZone: "UTC",
                        })}{" "}
                        · {event.players} players · top {event.topCut.length} published teams
                    </p>
                    <a
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="prep-text-link mt-4 inline-flex"
                    >
                        Open the original event record <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </header>
                <section className="py-10" aria-labelledby="teams-heading">
                    <h2 id="teams-heading" className="text-2xl font-semibold tracking-[-0.025em]">
                        Published teams
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        The top cut as published by the event. To dig into a team, paste it into
                        Claude or ChatGPT with the{" "}
                        <a href={CONNECTOR_DOCS_URL} className="prep-text-link">
                            VGC Teambuilder connector
                        </a>
                        .
                    </p>
                    <div className="mt-7 divide-y divide-border border-y border-border">
                        {event.topCut.map((placing) => (
                            <article
                                key={placing.placing}
                                className="grid gap-5 py-6 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-center"
                            >
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        Place {placing.placing}
                                    </p>
                                    <h3 className="mt-1 font-semibold">{placing.player}</h3>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {placing.record
                                            ? `${placing.record.wins}-${placing.record.losses}${placing.record.ties ? `-${placing.record.ties}` : ""}`
                                            : "Record unavailable"}
                                    </p>
                                </div>
                                <PokemonLineup team={eventPlacingToPokemon(placing)} />
                            </article>
                        ))}
                    </div>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
}
