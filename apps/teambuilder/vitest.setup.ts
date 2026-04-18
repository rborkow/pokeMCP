import "@testing-library/jest-dom/vitest";

// Import vi from vitest
import { vi } from "vitest";

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = vi.fn();

// ResizeObserver is not available in jsdom but required by cmdk / Radix UI
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};
