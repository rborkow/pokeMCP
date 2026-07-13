import { ArrowRight, Clock3, ExternalLink } from "lucide-react";
import Link from "next/link";
import { ContinuePrep } from "@/components/prep/ContinuePrep";
import { EvidenceBadge } from "@/components/prep/EvidenceBadge";
import { PokemonLineup } from "@/components/prep/PokemonLineup";
import { PrepHeader } from "@/components/prep/PrepHeader";
import { NewsroomTracker } from "@/components/prep/NewsroomTracker";
import { getEventForRequest, getNewsroomEvents } from "@/lib/live-events";
import { eventPlacingToPokemon } from "@/lib/prep/event-team";
import { getLatestReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });

export default async function NewsroomPage() {
    const newsroom = await getNewsroomEvents();
    const events = newsroom.events;
    const latestEvent = events[0] ? await getEventForRequest(events[0].slug) : null;
    const latestReport = getLatestReport("champions");
    const changes = (latestEvent?.usageComparison ?? [])
        .filter((row) => row.ladderUsage != null)
        .map((row) => ({ ...row, delta: row.pct - (row.ladderUsage ?? 0) * 100 }))
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 4);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <NewsroomTracker />
            <PrepHeader />
            <main className="prep-shell pb-20 pt-10 md:pt-16">
                <section className="grid gap-10 border-b border-border pb-12 md:grid-cols-[minmax(0,1.45fr)_minmax(260px,.55fr)] md:items-end">
                    <div>
                        <div className="mb-5 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs text-primary">
                                Champions Reg M-B
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                                {newsroom.stale ? "Update delayed · " : "Data refreshed · "}
                                {newsroom.fetchedAt ? formatDate(newsroom.fetchedAt) : "latest published event"}
                            </span>
                        </div>
                        <h1 className="max-w-[16ch] text-balance text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
                            Prepare for the teams people are actually bringing.
                        </h1>
                        <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
                            Study current Champions results, choose an opposing team, and leave with a battle card you can practice.
                        </p>
                        <div className="mt-7 flex flex-wrap gap-3">
                            <Link href="/prep/new" className="prep-button-primary">
                                Start a matchup plan
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                            <Link href="/teams" className="prep-button-secondary">
                                Open your teams
                            </Link>
                        </div>
                    </div>
                    <div>
                        <p className="mb-3 text-sm font-medium text-foreground">Continue at your desk</p>
                        <ContinuePrep />
                    </div>
                </section>

                <section className="py-12" aria-labelledby="field-heading">
                    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h2 id="field-heading" className="text-2xl font-semibold tracking-[-0.025em]">
                                What changed in the field
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                The largest differences between the latest published top cut and weighted ladder usage. Small top cuts can swing sharply.
                            </p>
                        </div>
                        {latestReport && (
                            <Link href={`/reports/champions/${latestReport.month}`} className="prep-text-link">
                                Read the {latestReport.month} report <ArrowRight className="h-4 w-4" />
                            </Link>
                        )}
                    </div>
                    {changes.length ? (
                        <div className="overflow-x-auto border-y border-border">
                            <table className="w-full min-w-[620px] border-collapse text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-muted-foreground">
                                        <th className="py-3 pr-5 font-medium">Pokémon</th>
                                        <th className="px-5 py-3 font-medium">Latest top cut</th>
                                        <th className="px-5 py-3 font-medium">Ladder</th>
                                        <th className="py-3 pl-5 text-right font-medium">Difference</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {changes.map((row) => (
                                        <tr key={row.id} className="border-t border-border">
                                            <td className="py-4 pr-5 font-medium">{row.name}</td>
                                            <td className="px-5 py-4">{row.pct.toFixed(0)}%</td>
                                            <td className="px-5 py-4 text-muted-foreground">{((row.ladderUsage ?? 0) * 100).toFixed(1)}%</td>
                                            <td className={`py-4 pl-5 text-right font-medium ${row.delta >= 0 ? "text-sage" : "text-rust"}`}>
                                                {row.delta >= 0 ? "+" : ""}{row.delta.toFixed(1)} pts
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="border-y border-border py-6 text-sm text-muted-foreground">
                            The latest event does not include a comparable ladder snapshot.
                        </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <EvidenceBadge kind="tournament-source" />
                        <EvidenceBadge kind="calculated" label="Top-cut vs ladder difference" />
                    </div>
                </section>

                <section className="border-t border-border py-12" aria-labelledby="events-heading">
                    <div className="mb-7 flex items-end justify-between gap-4">
                        <div>
                            <h2 id="events-heading" className="text-2xl font-semibold tracking-[-0.025em]">Recent events</h2>
                            <p className="mt-2 text-sm text-muted-foreground">Completed public events with published team lists.</p>
                        </div>
                    </div>
                    <div className="divide-y divide-border border-y border-border">
                        {events.map((event) => (
                            <Link key={event.slug} href={`/events/${event.slug}`} className="group grid gap-3 py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
                                <span>
                                    <span className="block font-medium text-foreground group-hover:text-primary">{event.name}</span>
                                    <span className="mt-1 block text-xs text-muted-foreground">{event.regulationLabel}</span>
                                </span>
                                <span className="text-sm text-muted-foreground">{formatDate(event.date)}</span>
                                <span className="flex items-center justify-between gap-3 text-sm text-muted-foreground sm:justify-end">
                                    {event.players} players
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>

                {latestEvent && (
                    <section className="border-t border-border py-12" aria-labelledby="study-heading">
                        <div className="mb-7">
                            <h2 id="study-heading" className="text-2xl font-semibold tracking-[-0.025em]">Teams to study now</h2>
                            <p className="mt-2 text-sm text-muted-foreground">Start from a real team sheet and make the plan yours.</p>
                        </div>
                        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-3">
                            {latestEvent.topCut.slice(0, 3).map((placing) => (
                                <article key={placing.placing} className="flex flex-col bg-panel p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground">#{placing.placing} · {placing.record ? `${placing.record.wins}-${placing.record.losses}` : "record unavailable"}</p>
                                            <h3 className="mt-1 font-semibold">{placing.player}</h3>
                                        </div>
                                        <EvidenceBadge kind="tournament-source" label="Published" />
                                    </div>
                                    <div className="mt-5 flex-1">
                                        <PokemonLineup team={eventPlacingToPokemon(placing)} compact />
                                    </div>
                                    <Link href={`/prep/new?event=${latestEvent.slug}&placing=${placing.placing}`} className="prep-button-secondary mt-6 w-full justify-center">
                                        Prepare against this team
                                    </Link>
                                </article>
                            ))}
                        </div>
                        <a href={latestEvent.sourceUrl} target="_blank" rel="noopener noreferrer" className="prep-text-link mt-4 inline-flex">
                            Source: Limitless event record <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </section>
                )}
            </main>
        </div>
    );
}
