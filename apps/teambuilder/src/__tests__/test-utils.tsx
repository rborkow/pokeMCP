import { type RenderOptions, render } from "@testing-library/react";
import type React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

function AllProviders({ children }: { children: React.ReactNode }) {
    return <TooltipProvider>{children}</TooltipProvider>;
}

function renderWithProviders(ui: React.ReactElement, options?: Omit<RenderOptions, "wrapper">) {
    return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from testing-library
export * from "@testing-library/react";

// Override render with our custom one
export { renderWithProviders as render };
