"use client";

import { Check, Cloud, LogOut, Shield, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { usePrepStore } from "@/stores/prep-store";
import type { CoachMessage, PrepPlan, TeamSnapshot } from "@/lib/prep/schema";

type SyncState = "idle" | "syncing" | "synced" | "error";

export function AccountPanel() {
    const { data: session, isPending } = authClient.useSession();
    const [syncState, setSyncState] = useState<SyncState>("idle");
    const [message, setMessage] = useState<string | null>(null);
    const replaceWorkspace = usePrepStore((state) => state.replaceWorkspace);

    useEffect(() => {
        if (!session?.user.id || !usePrepStore.persist.hasHydrated()) return;
        const syncKey = `pokemcp-prep-synced:${session.user.id}`;
        if (sessionStorage.getItem(syncKey)) {
            queueMicrotask(() => setSyncState("synced"));
            return;
        }
        const sync = async () => {
            setSyncState("syncing");
            const state = usePrepStore.getState();
            try {
                const response = await fetch("/api/prep/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        teams: state.teams,
                        plans: state.plans,
                        coachMessages: state.coachMessages,
                    }),
                });
                const result = (await response.json()) as {
                    teams: TeamSnapshot[];
                    plans: PrepPlan[];
                    coachMessages: Record<string, CoachMessage[]>;
                    error?: string;
                };
                if (!response.ok) throw new Error(result.error ?? "Sync failed.");
                replaceWorkspace(result);
                sessionStorage.setItem(syncKey, new Date().toISOString());
                setSyncState("synced");
                setMessage("This browser and your account are in sync.");
            } catch (error) {
                setSyncState("error");
                setMessage(error instanceof Error ? error.message : "Sync failed.");
            }
        };
        void sync();
    }, [replaceWorkspace, session?.user.id]);

    async function deleteAccount() {
        const confirmed = window.confirm(
            "Delete your synced teams, prep plans, coach history, and account? Local browser data will remain until you clear it.",
        );
        if (!confirmed) return;
        setMessage(null);
        const productDelete = await fetch("/api/prep/sync", { method: "DELETE" });
        if (!productDelete.ok) {
            setMessage("Account data could not be deleted. Nothing else was changed.");
            return;
        }
        const result = await authClient.deleteUser({ callbackURL: "/" });
        if (result.error) setMessage(result.error.message ?? "Account deletion failed.");
    }

    if (isPending) return <p className="py-10 text-sm text-muted-foreground" role="status">Checking account status…</p>;

    if (!session) {
        return (
            <div className="grid gap-10 lg:grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)]">
                <section>
                    <h2 className="text-xl font-semibold">Keep using Prep anonymously</h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">Every preparation feature works without an account. Teams and plans stay in this browser and can be exported as JSON.</p>
                </section>
                <section className="rounded-lg border border-border bg-panel p-6">
                    <h2 className="text-xl font-semibold">Sync across browsers</h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">Signing in claims this browser&apos;s saved teams, plans, and coach history. The newest version of an item wins when the same ID exists in both places.</p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <button type="button" onClick={() => authClient.signIn.social({ provider: "discord", callbackURL: "/account" })} className="prep-button-primary justify-center">Continue with Discord</button>
                        <button type="button" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/account" })} className="prep-button-secondary justify-center">Continue with Google</button>
                    </div>
                    <p className="mt-5 text-xs leading-5 text-muted-foreground">PokeMCP Prep stores only the account profile required by the provider plus the product data you choose to sync. Prompt and response content is not collected for model training by default.</p>
                </section>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            <section className="flex flex-col justify-between gap-6 border-b border-border pb-8 sm:flex-row sm:items-start">
                <div>
                    <p className="text-sm text-muted-foreground">Signed in as</p>
                    <h2 className="mt-1 text-xl font-semibold">{session.user.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{session.user.email}</p>
                </div>
                <button type="button" onClick={() => authClient.signOut()} className="prep-button-secondary justify-center"><LogOut className="h-4 w-4" /> Sign out</button>
            </section>
            <section className="grid gap-5 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-panel p-5">
                    <div className="flex items-center gap-2"><Cloud className="h-4 w-4 text-primary" /><h2 className="font-semibold">Workspace sync</h2></div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{syncState === "syncing" ? "Merging this browser with your account…" : syncState === "synced" ? "This browser is synced." : syncState === "error" ? "Sync needs attention." : "Sync will start after sign-in."}</p>
                    {syncState === "synced" && <p className="mt-3 inline-flex items-center gap-2 text-sm text-sage"><Check className="h-4 w-4" /> Up to date</p>}
                </div>
                <div className="rounded-lg border border-border bg-panel p-5">
                    <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-ochre" /><h2 className="font-semibold">Privacy</h2></div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">Operational events measure the prep funnel. Team and coach content is stored only to provide sync and is not opted into training.</p>
                </div>
            </section>
            {message && <p role="status" className={syncState === "error" ? "text-sm text-rust" : "text-sm text-sage"}>{message}</p>}
            <section className="border-t border-border pt-8">
                <h2 className="text-xl font-semibold text-rust">Delete account data</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">This permanently deletes synced teams, plans, coach history, sessions, and provider links. Anonymous data in this browser is not silently removed.</p>
                <button type="button" onClick={deleteAccount} className="prep-button-secondary mt-5 border-rust/40 text-rust hover:border-rust"><Trash2 className="h-4 w-4" /> Delete account</button>
            </section>
        </div>
    );
}
