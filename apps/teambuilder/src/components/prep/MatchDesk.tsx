"use client";

import { Check, Clipboard, Download, Printer, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CoachPanel } from "@/components/prep/CoachPanel";
import { EvidenceBadge } from "@/components/prep/EvidenceBadge";
import { PokemonLineup } from "@/components/prep/PokemonLineup";
import { battleCardToMarkdown } from "@/lib/prep/markdown";
import { trackPrepEvent } from "@/lib/prep/analytics";
import type { EvidenceReference, PrepPlan } from "@/lib/prep/schema";
import { usePrepStore } from "@/stores/prep-store";

function EvidenceList({ plan, ids }: { plan: PrepPlan; ids: string[] }) {
    const evidence = ids
        .map((id) => plan.battleCard.evidence.find((item) => item.id === id))
        .filter((item): item is EvidenceReference => Boolean(item));
    return (
        <div className="mt-3 flex flex-wrap gap-2">
            {evidence.map((item) => (
                <EvidenceBadge key={item.id} kind={item.kind} label={item.label} />
            ))}
        </div>
    );
}

export function MatchDesk({ planId }: { planId: string }) {
    const plan = usePrepStore((state) => state.plans.find((item) => item.id === planId));
    const updatePlan = usePrepStore((state) => state.updatePlan);
    const [hydrated, setHydrated] = useState(usePrepStore.persist.hasHydrated());
    const [copied, setCopied] = useState(false);

    useEffect(() => usePrepStore.persist.onFinishHydration(() => setHydrated(true)), []);

    if (!hydrated) {
        return <div className="prep-shell py-20 text-sm text-muted-foreground" role="status">Opening your saved battle card…</div>;
    }
    if (!plan) {
        return (
            <div className="prep-shell py-20">
                <h1 className="text-2xl font-semibold">This battle card is not on this device.</h1>
                <p className="mt-3 max-w-xl text-muted-foreground">Anonymous plans stay in this browser. If you exported the workspace, restore it from the Teams page.</p>
                <Link href="/prep/new" className="prep-button-primary mt-6">Start a new prep</Link>
            </div>
        );
    }

    const currentPlan = plan;
    const card = currentPlan.battleCard;

    async function copyMarkdown() {
        await navigator.clipboard.writeText(battleCardToMarkdown(currentPlan));
        updatePlan(currentPlan.id, { exportedAt: new Date().toISOString() });
        trackPrepEvent("plan_exported", { format: currentPlan.format, source: "markdown" });
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2_000);
    }

    function printPlan() {
        updatePlan(currentPlan.id, { exportedAt: new Date().toISOString() });
        trackPrepEvent("plan_exported", { format: currentPlan.format, source: "print" });
        window.print();
    }

    function togglePractice(index: number) {
        updatePlan(currentPlan.id, {
            battleCard: {
                ...card,
                practiceChecklist: card.practiceChecklist.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, done: !item.done } : item,
                ),
            },
        });
    }

    return (
        <main className="prep-shell pb-20 pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6 print:hidden">
                <Link href="/" className="prep-text-link"><RotateCcw className="h-4 w-4" /> Back to newsroom</Link>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={copyMarkdown} className="prep-button-secondary">
                        {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                        {copied ? "Copied" : "Copy Markdown"}
                    </button>
                    <button type="button" onClick={printPlan} className="prep-button-secondary">
                        <Printer className="h-4 w-4" /> Print / PDF
                    </button>
                </div>
            </div>

            <header className="grid gap-8 border-b border-border py-10 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
                <div>
                    <p className="text-xs text-muted-foreground">Your team</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">{plan.ownTeam.name}</h1>
                    <div className="mt-4"><PokemonLineup team={plan.ownTeam.pokemon} compact /></div>
                </div>
                <div className="hidden h-full w-px bg-border lg:block" aria-hidden="true" />
                <div className="lg:text-right">
                    <p className="text-xs text-muted-foreground">Preparing for</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">{plan.opponentTeam.name}</h2>
                    <div className="mt-4 flex lg:justify-end"><PokemonLineup team={plan.opponentTeam.pokemon} compact /></div>
                    {plan.opponentTeam.sourceUrl && (
                        <a href={plan.opponentTeam.sourceUrl} target="_blank" rel="noopener noreferrer" className="prep-text-link mt-3 inline-flex">Open source record</a>
                    )}
                </div>
            </header>

            <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
                <div className="min-w-0 space-y-10">
                    <section aria-labelledby="bring-heading">
                        <p className="text-sm text-muted-foreground">Battle card</p>
                        <h2 id="bring-heading" className="mt-1 text-2xl font-semibold">Bring 4</h2>
                        <ol className="mt-5 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
                            {card.bringFour.map((pokemon, index) => (
                                <li key={`${pokemon}-${index}`} className="flex items-center gap-3 bg-panel p-4">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-inset text-xs text-muted-foreground">{index + 1}</span>
                                    <span className="font-medium">{pokemon}</span>
                                </li>
                            ))}
                        </ol>
                        <EvidenceList plan={plan} ids={["calc-team-sheet", "beta-vp"]} />
                    </section>

                    <section aria-labelledby="leads-heading">
                        <h2 id="leads-heading" className="text-xl font-semibold">Lead plans</h2>
                        <div className="mt-4 divide-y divide-border border-y border-border">
                            {card.leadPlans.map((lead, index) => (
                                <article key={lead.pokemon.join("-")} className="py-5">
                                    <p className="text-xs text-muted-foreground">{index === 0 ? "Primary lead" : "Alternative lead"}</p>
                                    <h3 className="mt-1 text-lg font-semibold">{lead.pokemon.join(" + ")}</h3>
                                    <p className="mt-2 max-w-2xl text-sm leading-6">{lead.purpose}</p>
                                    <p className="mt-2 text-sm text-muted-foreground"><span className="text-foreground">Use when:</span> {lead.useWhen}</p>
                                    <EvidenceList plan={plan} ids={lead.evidenceIds} />
                                </article>
                            ))}
                        </div>
                    </section>

                    <section aria-labelledby="openings-heading">
                        <h2 id="openings-heading" className="text-xl font-semibold">Opening lines</h2>
                        <div className="mt-4 space-y-4">
                            {card.openingLines.map((line) => (
                                <article key={line.lead.join("-")} className="rounded-lg border border-border bg-panel p-5">
                                    <h3 className="font-semibold">{line.lead.join(" + ")}</h3>
                                    <p className="mt-3 text-sm leading-6">{line.primary}</p>
                                    <p className="mt-3 border-t border-border pt-3 text-sm leading-6 text-muted-foreground"><span className="text-foreground">Alternative:</span> {line.alternative}</p>
                                    <EvidenceList plan={plan} ids={line.evidenceIds} />
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="min-w-0" aria-labelledby="roles-heading">
                        <h2 id="roles-heading" className="text-xl font-semibold">Matchup roles</h2>
                        <div className="mt-4 overflow-x-auto border-y border-border">
                            <table className="w-full min-w-[600px] border-collapse text-sm">
                                <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-3 pr-5 font-medium">Pokémon</th><th className="px-5 py-3 font-medium">Role</th><th className="py-3 pl-5 font-medium">Why it matters</th></tr></thead>
                                <tbody>{card.matchupRoles.map((role) => (
                                    <tr key={role.pokemon} className="border-t border-border"><td className="py-4 pr-5 font-medium">{role.pokemon}</td><td className="px-5 py-4 text-sage">{role.role}</td><td className="py-4 pl-5 text-muted-foreground">{role.note}</td></tr>
                                ))}</tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <aside className="space-y-8">
                    <section aria-labelledby="opponent-leads-heading">
                        <h2 id="opponent-leads-heading" className="text-lg font-semibold">Likely opposing lead</h2>
                        {card.likelyOpponentLeads.map((lead) => (
                            <div key={lead.pokemon.join("-")} className="mt-4 rounded-lg border border-border bg-panel p-5">
                                <p className="font-semibold">{lead.pokemon.join(" + ")}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{lead.purpose}</p>
                                <p className="mt-3 text-xs text-ochre">{lead.useWhen}</p>
                                <EvidenceList plan={plan} ids={lead.evidenceIds} />
                            </div>
                        ))}
                    </section>

                    <section aria-labelledby="danger-heading">
                        <h2 id="danger-heading" className="text-lg font-semibold">Danger points</h2>
                        <div className="mt-4 divide-y divide-border border-y border-border">
                            {card.dangerPoints.map((point) => (
                                <article key={point.title} className="py-4">
                                    <h3 className="font-medium text-rust">{point.title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{point.detail}</p>
                                    <p className="mt-2 text-sm leading-6"><span className="text-sage">Response:</span> {point.response}</p>
                                    <EvidenceList plan={plan} ids={point.evidenceIds} />
                                </article>
                            ))}
                        </div>
                    </section>

                    <section aria-labelledby="practice-heading">
                        <div className="flex items-center justify-between gap-3">
                            <h2 id="practice-heading" className="text-lg font-semibold">Practice checklist</h2>
                            <Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <div className="mt-4 space-y-2">
                            {card.practiceChecklist.map((item, index) => (
                                <label key={item.label} className="flex cursor-pointer gap-3 rounded-md border border-border bg-panel p-3 text-sm leading-5 hover:border-primary/50">
                                    <input type="checkbox" checked={item.done} onChange={() => togglePractice(index)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
                                    <span className={item.done ? "text-muted-foreground line-through" : "text-foreground"}>{item.label}</span>
                                </label>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>

            <section className="border-t border-border py-8" aria-labelledby="evidence-heading">
                <h2 id="evidence-heading" className="text-xl font-semibold">Evidence and limitations</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {card.evidence.map((evidence) => (
                        <article key={evidence.id} className="rounded-lg border border-border bg-panel p-4">
                            <EvidenceBadge kind={evidence.kind} label={evidence.label} />
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">{evidence.detail}</p>
                        </article>
                    ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">Generated with mechanics profile {plan.mechanicsVersion}. Saved {new Date(plan.updatedAt).toLocaleString()}.</p>
            </section>

            <CoachPanel plan={plan} />
        </main>
    );
}
