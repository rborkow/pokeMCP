"use client";

import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary level="root">
            <TooltipProvider>{children}</TooltipProvider>
        </ErrorBoundary>
    );
}
