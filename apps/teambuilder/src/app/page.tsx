import { DeveloperFooter } from "@/components/landing/DeveloperFooter";
import { Hero } from "@/components/landing/Hero";
import { InterviewDemoStatic } from "@/components/landing/InterviewDemoStatic";
import { SavedTeamRedirect } from "@/components/landing/SavedTeamRedirect";
import { ThreeMoments } from "@/components/landing/ThreeMoments";
import { TrustChips } from "@/components/landing/TrustChips";

export default function LandingPage() {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <SavedTeamRedirect />
            <div className="mx-auto w-full max-w-[880px] flex-1">
                <div className="mt-6 md:mt-10 rounded-xl border border-border bg-background/60 overflow-hidden">
                    <Hero />
                    <InterviewDemoStatic />
                    <ThreeMoments />
                    <TrustChips />
                    <DeveloperFooter />
                </div>
            </div>
        </div>
    );
}
