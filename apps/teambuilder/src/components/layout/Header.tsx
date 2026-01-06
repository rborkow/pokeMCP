"use client";

import Link from "next/link";
import { ModeToggle } from "./ModeToggle";
import { FormatSelector } from "./FormatSelector";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {/* Pokeball icon */}
          <div className="pokeball-icon scale-75" />
          <Link href="/" className="flex items-baseline gap-0">
            <span className="font-display font-bold text-xl text-gradient">Poke</span>
            <span className="font-display font-bold text-xl text-foreground">MCP</span>
          </Link>
          <span className="hidden sm:inline text-sm text-muted-foreground ml-2">Team Builder</span>
        </div>

        <div className="flex items-center gap-3">
          <ModeToggle />
          <FormatSelector />
        </div>
      </div>
    </header>
  );
}
