import { MatchDesk } from "@/components/prep/MatchDesk";
import { PrepHeader } from "@/components/prep/PrepHeader";

export const metadata = {
    title: "Match Desk",
    description: "A saved Champions matchup plan with Bring 4, leads, opening lines, risks, and practice work.",
};

export default async function MatchDeskPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <div className="min-h-screen">
            <PrepHeader />
            <MatchDesk planId={id} />
        </div>
    );
}
