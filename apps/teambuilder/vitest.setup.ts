import "@testing-library/jest-dom/vitest";

// Mock scrollIntoView which is not available in jsdom
if (typeof Element !== "undefined") {
    Element.prototype.scrollIntoView = vi.fn();
}

// Import vi from vitest
import { vi } from "vitest";
