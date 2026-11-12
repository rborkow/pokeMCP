"use client";

import { Check, Clipboard, Package, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PokemonSprite } from "@/components/team/PokemonSprite";
import { Button } from "@/components/ui/button";
import { CONNECTOR_DOCS_URL } from "@/lib/connector";
import type { SharedTeam } from "@/lib/share-api";
import { exportShowdownTeam } from "@/lib/showdown-parser";
import { getFormatDisplayName } from "@/types/pokemon";

interface SharedTeamViewProps {
    team: SharedTeam;
}

export function SharedTeamView({ team: sharedTeam }: SharedTeamViewProps) {
    const [copied, setCopied] = useState(false);

    // The team builder is gone; a shared team is read-only. Copying it as
    // Showdown text is how it travels now — into Pokémon Showdown, or into
    // an assistant that has the VGC Teambuilder connector.
    const copyAsShowdownText = async () => {
        try {
            await navigator.clipboard.writeText(exportShowdownTeam(sharedTeam.team));
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col">
            <main className="relative flex-1 container max-w-screen-lg px-4 py-10">
                <div className="space-y-8">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                            Shared team
                        </h1>
                        <p className="text-muted-foreground">
                            <span className="px-2 py-0.5 rounded bg-muted text-sm font-medium tracking-wider">
                                {getFormatDisplayName(sharedTeam.format)}
                            </span>
                            <span className="mx-2 text-muted-foreground/50">-</span>
                            {sharedTeam.team.length} Pokemon
                        </p>
                    </div>

                    {/* Team Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sharedTeam.team.map((member, i) => (
                            <div
                                key={`${member.pokemon}-${i}`}
                                className="rounded-xl border bg-card/50 p-4 space-y-3"
                            >
                                {/* Pokemon Name + Sprite */}
                                <div className="flex items-center gap-3">
                                    <PokemonSprite pokemon={member.pokemon} size="lg" />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-lg truncate">
                                            {member.pokemon}
                                        </h3>
                                        {member.item && (
                                            <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                                                <Package className="h-3 w-3 shrink-0" />
                                                {member.item}
                                            </p>
                                        )}
                                        {member.ability && (
                                            <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                                                <Sparkles className="h-3 w-3 shrink-0" />
                                                {member.ability}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Moves */}
                                {member.moves.length > 0 && (
                                    <div className="grid grid-cols-2 gap-1">
                                        {member.moves.map((move) => (
                                            <span
                                                key={move}
                                                className="text-xs px-2 py-1 rounded bg-muted truncate"
                                            >
                                                {move}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Details row */}
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    {member.nature && <span>{member.nature}</span>}
                                    {member.teraType && (
                                        <span className="px-1.5 py-0.5 rounded bg-muted">
                                            Tera: {member.teraType}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <div className="space-y-3 text-center">
                        <Button onClick={copyAsShowdownText} size="lg" className="gap-2">
                            {copied ? (
                                <Check className="h-4 w-4" aria-hidden="true" />
                            ) : (
                                <Clipboard className="h-4 w-4" aria-hidden="true" />
                            )}
                            {copied ? "Copied" : "Copy as Showdown text"}
                        </Button>
                        <p className="text-sm text-muted-foreground">
                            Paste it into Claude or ChatGPT with the{" "}
                            <a
                                href={CONNECTOR_DOCS_URL}
                                className="underline hover:text-foreground"
                            >
                                VGC Teambuilder connector
                            </a>{" "}
                            to check or improve the team.
                        </p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t py-4 mt-8">
                <div className="container max-w-screen-2xl px-4 text-center text-sm text-muted-foreground">
                    <span>PokeMCP</span>
                    <nav aria-label="Footer" className="inline">
                        {" \u2022 "}
                        <Link
                            href="/"
                            className="underline hover:text-foreground py-2 inline-block"
                        >
                            Results and reports
                        </Link>
                        {" \u2022 "}
                        <a
                            href="https://docs.pokemcp.com"
                            className="underline hover:text-foreground py-2 inline-block"
                        >
                            Documentation
                        </a>
                    </nav>
                </div>
            </footer>
        </div>
    );
}
