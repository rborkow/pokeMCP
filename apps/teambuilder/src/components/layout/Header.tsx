"use client";

import Link from "next/link";
import { FormatSelector } from "./FormatSelector";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">PokeMCP</span>
            <span className="hidden sm:inline text-sm text-muted-foreground">Team Builder</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <FormatSelector />
        </div>
      </div>
    </header>
  );
}
