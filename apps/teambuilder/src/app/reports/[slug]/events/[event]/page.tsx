import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type EventPageData, getEventParams, hasEventPage } from "@/lib/event-pages";
import { hasMonPage } from "@/lib/mon-pages";

export const dynamic = "force-static";
export const dynamicParams = false;

const SITE_URL = "https://www.pokemcp.com";

interface PageProps {
    params: Promise<{ slug: string; event: string }>;
}

export function generateStaticParams() {
    return getEventParams();
}

async function loadEvent(slug: string, eventSlug: string): Promise<EventPageData | null> {
    if (!hasEventPage(slug, eventSlug)) return null;
    const data = await import(`@/data/events/${slug}/${eventSlug}.json`);
    return data.default as EventPageData;
}

const fmtDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });

const fmtRecord = (record: EventPageData["topCut"][number]["record"]) =>
    record ? `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ""}` : "—";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug, event } = await params;
    const data = await loadEvent(slug, event);
    if (!data) return { title: "Event Not Found" };

    const title = `${data.name} — Results & Teams`;
    const description = `Top ${data.topCut.length} teams with full builds from ${data.name} (${fmtDate(data.date)}, ${data.players} players, ${data.regulationLabel}). Winner: ${data.topCut[0]?.player ?? "?"}.`;
    return {
        title,
        description,
        alternates: { canonical: `${SITE_URL}/reports/${slug}/events/${event}` },
        openGraph: {
            title,
            description,
            type: "article",
            publishedTime: data.date,
        },
    };
}

function MonName({ slug, id, name }: { slug: string; id: string; name: string }) {
    return hasMonPage(slug, id) ? (
        <Link href={`/pokemon/${id}/${slug}`} className="underline underline-offset-4">
            {name}
        </Link>
    ) : (
        <>{name}</>
    );
}

export default async function EventPage({ params }: PageProps) {
    const { slug, event } = await params;
    const data = await loadEvent(slug, event);
    if (!data) notFound();

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: `${data.name} — Results & Teams`,
        datePublished: data.date,
        mainEntityOfPage: `${SITE_URL}/reports/${slug}/events/${event}`,
        author: { "@type": "Organization", name: "PokeMCP", url: SITE_URL },
        publisher: { "@type": "Organization", name: "PokeMCP", url: SITE_URL },
    };

    return (
        <article className="mx-auto w-full max-w-3xl px-4 py-10">
            <script
                type="application/ld+json"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD from our own data; "<" escaped
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
                }}
            />
            <header className="mb-8 border-b border-border pb-6">
                <p className="signal-mono mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Link href="/reports" className="hover:text-foreground">
                        Meta Reports
                    </Link>{" "}
                    /{" "}
                    <Link href={`/reports/${slug}`} className="hover:text-foreground">
                        {data.regulationLabel}
                    </Link>{" "}
                    / Tournaments
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                    {data.name}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                    {fmtDate(data.date)} · {data.players} players · {data.regulationLabel} · record
                    of the event as published; analysis of record, not live coverage
                </p>
            </header>

            <section>
                <h2 className="mb-4 text-xl font-semibold tracking-tight text-foreground">
                    Top {data.topCut.length} standings
                </h2>
                <table className="w-full border-collapse text-sm">
                    <thead className="border-b border-border text-left">
                        <tr>
                            <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                Place
                            </th>
                            <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                Player
                            </th>
                            <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                Record
                            </th>
                            <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                Team
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.topCut.map((placing) => (
                            <tr key={placing.placing}>
                                <td className="border-b border-border px-3 py-2 text-foreground">
                                    {placing.placing}
                                </td>
                                <td className="border-b border-border px-3 py-2 text-foreground">
                                    {placing.player}
                                </td>
                                <td className="border-b border-border px-3 py-2 text-foreground">
                                    {fmtRecord(placing.record)}
                                </td>
                                <td className="border-b border-border px-3 py-2 text-foreground">
                                    {placing.team.map((slot, i) => (
                                        <span key={slot.id}>
                                            {i > 0 && ", "}
                                            <MonName slug={slug} id={slot.id} name={slot.name} />
                                        </span>
                                    ))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <section>
                <h2 className="mt-10 mb-4 text-xl font-semibold tracking-tight text-foreground">
                    Top-cut usage vs ladder
                </h2>
                <table className="w-full max-w-lg border-collapse text-sm">
                    <thead className="border-b border-border text-left">
                        <tr>
                            <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                Pokémon
                            </th>
                            <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                Top cut
                            </th>
                            <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                Ladder
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.usageComparison.slice(0, 12).map((row) => (
                            <tr key={row.id}>
                                <td className="border-b border-border px-3 py-2 text-foreground">
                                    <MonName slug={slug} id={row.id} name={row.name} />
                                </td>
                                <td className="border-b border-border px-3 py-2 text-foreground">
                                    {row.count}/{data.topCut.length} ({row.pct.toFixed(0)}%)
                                </td>
                                <td className="border-b border-border px-3 py-2 text-foreground">
                                    {row.ladderUsage != null
                                        ? `${(row.ladderUsage * 100).toFixed(2)}%`
                                        : "<0.5%"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="mt-2 text-xs text-muted-foreground">
                    Ladder usage is the Smogon weighted usage for the report month at generation
                    time.
                </p>
            </section>

            <section>
                <h2 className="mt-10 mb-4 text-xl font-semibold tracking-tight text-foreground">
                    Teams and builds
                </h2>
                <div className="space-y-8">
                    {data.topCut.map((placing) => (
                        <div key={placing.placing}>
                            <h3 className="mb-2 text-lg font-semibold text-foreground">
                                #{placing.placing} — {placing.player} ({fmtRecord(placing.record)})
                            </h3>
                            <table className="w-full border-collapse text-sm">
                                <thead className="border-b border-border text-left">
                                    <tr>
                                        <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                            Pokémon
                                        </th>
                                        <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                            Item
                                        </th>
                                        <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                            Ability
                                        </th>
                                        <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                            Nature
                                        </th>
                                        <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                            Moves
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {placing.team.map((slot) => (
                                        <tr key={slot.id}>
                                            <td className="border-b border-border px-3 py-2 text-foreground">
                                                <MonName
                                                    slug={slug}
                                                    id={slot.id}
                                                    name={slot.name}
                                                />
                                            </td>
                                            <td className="border-b border-border px-3 py-2 text-foreground">
                                                {slot.item ?? "—"}
                                            </td>
                                            <td className="border-b border-border px-3 py-2 text-foreground">
                                                {slot.ability ?? "—"}
                                            </td>
                                            <td className="border-b border-border px-3 py-2 text-foreground">
                                                {slot.nature ?? "—"}
                                            </td>
                                            <td className="border-b border-border px-3 py-2 text-foreground">
                                                {slot.moves.join(", ")}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="mt-12 space-y-4 border-t border-border pt-6">
                <p className="text-sm text-muted-foreground">
                    {data.attribution} —{" "}
                    <a
                        href={data.sourceUrl}
                        className="underline underline-offset-4 hover:text-foreground"
                        rel="noopener"
                    >
                        original event page
                    </a>
                    . Team compositions are factual tournament records; players seeking removal can
                    contact us via the feedback form.
                </p>
                <p className="text-sm text-muted-foreground">
                    For the broader picture, read the{" "}
                    <Link
                        href={`/reports/${slug}`}
                        className="text-foreground underline underline-offset-4"
                    >
                        latest meta report
                    </Link>
                    .
                </p>
            </footer>
        </article>
    );
}
