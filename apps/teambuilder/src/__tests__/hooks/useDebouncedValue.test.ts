import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

describe("useDebouncedValue", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns the initial value immediately", () => {
        const { result } = renderHook(() => useDebouncedValue("gya", 300));
        expect(result.current).toBe("gya");
    });

    it("holds the previous value until the delay elapses", () => {
        const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
            initialProps: { v: "gya" },
        });

        rerender({ v: "gyarados" });
        expect(result.current).toBe("gya"); // not yet

        act(() => {
            vi.advanceTimersByTime(299);
        });
        expect(result.current).toBe("gya"); // still not yet

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(result.current).toBe("gyarados"); // now committed
    });

    it("only commits the final value across rapid keystrokes (debounce)", () => {
        const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
            initialProps: { v: "g" },
        });

        // Simulate fast typing: each change resets the timer.
        for (const v of ["gy", "gya", "gyar", "gyara", "gyarados"]) {
            rerender({ v });
            act(() => {
                vi.advanceTimersByTime(100); // < 300ms between keystrokes
            });
        }

        // Nothing committed mid-burst.
        expect(result.current).toBe("g");

        act(() => {
            vi.advanceTimersByTime(300);
        });
        // Only the last value lands — a single downstream fetch, not six.
        expect(result.current).toBe("gyarados");
    });
});
