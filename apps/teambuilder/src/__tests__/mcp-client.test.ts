import { describe, it, expect } from "vitest";
import { getEffectiveStatsFormat } from "@/lib/mcp-client";

describe("MCP Client", () => {
    describe("getEffectiveStatsFormat", () => {
        it("returns original format when no fallback needed", () => {
            const result = getEffectiveStatsFormat("gen9ou");
            expect(result.format).toBe("gen9ou");
            expect(result.isFallback).toBe(false);
        });

        it("falls back VGC 2026 Reg F to VGC 2024 Reg H", () => {
            const result = getEffectiveStatsFormat("gen9vgc2026regf");
            expect(result.format).toBe("gen9vgc2024regh");
            expect(result.isFallback).toBe(true);
        });

        it("falls back VGC 2026 Reg F Bo3 to VGC 2024 Reg H", () => {
            const result = getEffectiveStatsFormat("gen9vgc2026regfbo3");
            expect(result.format).toBe("gen9vgc2024regh");
            expect(result.isFallback).toBe(true);
        });

        it("falls back VGC 2025 Reg I to VGC 2024 Reg H", () => {
            const result = getEffectiveStatsFormat("gen9vgc2025regi");
            expect(result.format).toBe("gen9vgc2024regh");
            expect(result.isFallback).toBe(true);
        });

        it("handles uppercase format strings", () => {
            const result = getEffectiveStatsFormat("GEN9VGC2026REGF");
            expect(result.format).toBe("gen9vgc2024regh");
            expect(result.isFallback).toBe(true);
        });

        it("returns original format for VGC 2024 (has data)", () => {
            const result = getEffectiveStatsFormat("gen9vgc2024regh");
            expect(result.format).toBe("gen9vgc2024regh");
            expect(result.isFallback).toBe(false);
        });
    });
});
