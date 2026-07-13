"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
    { href: "/", label: "Newsroom" },
    { href: "/prep/new", label: "New prep" },
    { href: "/teams", label: "Teams" },
    { href: "/build", label: "Build" },
];

export function PrepHeader() {
    const pathname = usePathname() ?? "/";
    return (
        <header className="prep-header print:hidden">
            <div className="prep-shell flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
                <Link href="/" className="flex min-h-11 items-center gap-3 rounded-md py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-inset text-sm font-semibold text-primary" aria-hidden="true">
                        P
                    </span>
                    <span className="font-semibold tracking-[-0.02em] text-foreground">
                        PokeMCP <span className="text-muted-foreground">Prep</span>
                    </span>
                </Link>
                <nav aria-label="Primary" className="order-3 grid w-full grid-cols-4 items-center gap-1 sm:order-none sm:flex sm:w-auto">
                    {destinations.map((destination) => {
                        const active =
                            destination.href === "/"
                                ? pathname === "/"
                                : pathname.startsWith(destination.href);
                        return (
                            <Link
                                key={destination.href}
                                href={destination.href}
                                aria-current={active ? "page" : undefined}
                                className={`flex min-h-11 items-center justify-center whitespace-nowrap rounded-md px-1.5 py-2 text-center text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-3 ${
                                    active
                                        ? "bg-inset text-foreground"
                                        : "text-muted-foreground hover:bg-inset/70 hover:text-foreground"
                                }`}
                            >
                                {destination.label}
                            </Link>
                        );
                    })}
                </nav>
                <div className="flex items-center gap-1">
                    <Link
                        href="/privacy"
                        className="flex min-h-11 items-center rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-inset/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        Privacy
                    </Link>
                    <Link
                        href="/account"
                        className="flex min-h-11 items-center rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        Account
                    </Link>
                </div>
            </div>
        </header>
    );
}
