"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorFallbackProps {
    error: Error;
    resetErrorBoundary: () => void;
    level?: "root" | "section";
}

export function ErrorFallback({
    error,
    resetErrorBoundary,
    level = "section",
}: ErrorFallbackProps) {
    if (level === "root") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="rounded-full bg-destructive/10 p-4">
                            <AlertTriangle className="w-10 h-10 text-destructive" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-display font-bold text-foreground">
                            PokeMCP Team Builder
                        </h1>
                        <p className="text-muted-foreground">
                            Something went wrong and the app crashed.
                        </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 border border-border p-3">
                        <p className="text-sm text-muted-foreground font-mono break-all">
                            {error.message || "An unexpected error occurred"}
                        </p>
                    </div>
                    <Button onClick={resetErrorBoundary} className="gap-2" size="lg">
                        <RefreshCw className="w-4 h-4" />
                        Reload App
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
                <div className="rounded-full bg-destructive/10 p-1.5 mt-0.5">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm font-medium text-foreground">
                        This section encountered an error
                    </p>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                        {error.message || "An unexpected error occurred"}
                    </p>
                    <Button
                        onClick={resetErrorBoundary}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Try Again
                    </Button>
                </div>
            </div>
        </div>
    );
}
