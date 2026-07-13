"use client";

import Link from "next/link";
import { BetaBadge } from "@/components/landing/BetaBadge";
import { FormatSelector } from "./FormatSelector";
import { ModeSwitch } from "./ModeSwitch";
import { ModeToggle } from "./ModeToggle";

export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <Link href="/" className="flex items-baseline gap-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                        <span className="font-semibold text-xl text-foreground">PokeMCP</span>
                        <span className="text-sm text-muted-foreground">Prep</span>
                    </Link>
                    <BetaBadge className="ml-2" />
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
                    >
                        Newsroom
                    </Link>
                    <ModeSwitch />
                    <ModeToggle />
                    <FormatSelector />
                </div>
            </div>
        </header>
    );
}
