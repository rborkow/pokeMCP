import type React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

// Create a fresh QueryClient for each test
function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
        },
    });
}

interface ProvidersProps {
    children: React.ReactNode;
}

function AllProviders({ children }: ProvidersProps) {
    const queryClient = createTestQueryClient();
    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>{children}</TooltipProvider>
        </QueryClientProvider>
    );
}

function renderWithProviders(
    ui: React.ReactElement,
    options?: Omit<RenderOptions, "wrapper">
) {
    return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from testing-library
export * from "@testing-library/react";

// Override render with our custom one
export { renderWithProviders as render };
