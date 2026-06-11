import { DeveloperFooter } from "@/components/landing/DeveloperFooter";
import { Hero } from "@/components/landing/Hero";
import { InterviewDemoStatic } from "@/components/landing/InterviewDemoStatic";
import { LatestReportSection } from "@/components/landing/LatestReportSection";
import { SavedTeamRedirect } from "@/components/landing/SavedTeamRedirect";
import { ThreeMoments } from "@/components/landing/ThreeMoments";
import { TrustChips } from "@/components/landing/TrustChips";
import { LegalAttribution } from "@/components/layout/LegalAttribution";

export default function LandingPage() {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <SavedTeamRedirect />
            <div className="mx-auto w-full max-w-[880px] flex-1">
                <div className="mt-6 md:mt-10 rounded-xl border border-border bg-background/60 overflow-hidden">
                    <Hero />
                    <InterviewDemoStatic />
                    <ThreeMoments />
                    <LatestReportSection />
                    <TrustChips />
                    <DeveloperFooter />
                    <LegalAttribution className="border-t border-border bg-muted/40 px-6 md:px-10 py-4" />
                </div>
            </div>
        </div>
    );
}
