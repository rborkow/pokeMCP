import { AccountPanel } from "@/components/prep/AccountPanel";
import { PrepHeader } from "@/components/prep/PrepHeader";

export const metadata = { title: "Account and privacy" };

export default function AccountPage() {
    return (
        <div className="min-h-screen">
            <PrepHeader />
            <main className="prep-shell pb-20 pt-10">
                <header className="border-b border-border pb-8">
                    <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Account and privacy</h1>
                    <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">Anonymous preparation is complete. Sign in only if you want continuity across browsers.</p>
                </header>
                <div className="pt-10"><AccountPanel /></div>
            </main>
        </div>
    );
}
