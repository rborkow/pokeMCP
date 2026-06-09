"use client";

import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` has
 * elapsed without further changes. Used to throttle as-you-type autocomplete
 * so each keystroke doesn't fire its own network request (which also kept
 * polluting usage metrics with partial names like "gyar" / "kang").
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const handle = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(handle);
    }, [value, delayMs]);

    return debounced;
}
