import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchSharedTeam } from "@/lib/share-api";
import { SharedTeamView } from "./SharedTeamView";

interface PageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const sharedTeam = await fetchSharedTeam(id);

    if (!sharedTeam) {
        return { title: "Team Not Found" };
    }

    const pokemonNames = sharedTeam.team.map((p) => p.pokemon).join(", ");
    const formatName = sharedTeam.format.toUpperCase();
    const title = `${formatName} Team`;
    const description = `${formatName} team: ${pokemonNames}`;
    const ogImageUrl = `https://api.pokemcp.com/og/team/${sharedTeam.id}`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: `${formatName} team with ${pokemonNames}`,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [ogImageUrl],
        },
    };
}

export default async function SharedTeamPage({ params }: PageProps) {
    const { id } = await params;
    const sharedTeam = await fetchSharedTeam(id);

    if (!sharedTeam) {
        notFound();
    }

    return <SharedTeamView team={sharedTeam} />;
}
