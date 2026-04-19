"use client";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { InterviewShell } from "@/components/interview/InterviewShell";
import { TeamStatePanel } from "@/components/team/TeamStatePanel";
import { useInterviewStore } from "@/stores/interview-store";
import { useTeamStore } from "@/stores/team-store";

/**
 * 60/40 chat-first composition. Left pane is the conversation surface that
 * drives team state; right pane is the team panel + analysis strip that
 * reflects whatever the conversation has produced. When the team is empty
 * and the user hasn't skipped/completed the interview, the full canvas is
 * handed to InterviewShell instead.
 */
export interface ChatFirstFrameProps {
    defaultImportOpen?: boolean;
}

export function ChatFirstFrame({ defaultImportOpen }: ChatFirstFrameProps = {}) {
    const team = useTeamStore((s) => s.team);
    const interviewStatus = useInterviewStore((s) => s.status);

    const interviewActive =
        team.length === 0 && interviewStatus !== "skipped" && interviewStatus !== "applied";

    if (interviewActive) {
        return (
            <ErrorBoundary level="section">
                <InterviewShell />
            </ErrorBoundary>
        );
    }

    return (
        <div className="chat-first-surface grid min-h-[calc(100vh-8rem)] grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-5">
            <section
                aria-label="Coach chat"
                className="flex min-h-[70vh] flex-col lg:col-span-3 lg:min-h-[520px]"
            >
                <ErrorBoundary level="section">
                    <ChatPanel layout="fill" />
                </ErrorBoundary>
            </section>
            <section aria-label="Team state" className="lg:col-span-2">
                <ErrorBoundary level="section">
                    <TeamStatePanel defaultImportOpen={defaultImportOpen} />
                </ErrorBoundary>
            </section>
        </div>
    );
}
