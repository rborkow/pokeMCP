import { useEffect, useState } from "react";

interface FetchState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

export function useAdminData<T>(endpoint: string, range: string): FetchState<T> {
    const [state, setState] = useState<FetchState<T>>({
        data: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;

        async function fetchData() {
            setState((prev) => ({ ...prev, loading: true, error: null }));

            try {
                const separator = endpoint.includes("?") ? "&" : "?";
                const response = await fetch(`/api/admin/${endpoint}${separator}range=${range}`);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(
                        (errorData as { error?: string }).error || `HTTP ${response.status}`,
                    );
                }

                const data = (await response.json()) as T;
                if (!cancelled) {
                    setState({ data, loading: false, error: null });
                }
            } catch (err) {
                if (!cancelled) {
                    setState({
                        data: null,
                        loading: false,
                        error: err instanceof Error ? err.message : "Unknown error",
                    });
                }
            }
        }

        fetchData();

        // Refresh every 60 seconds
        const interval = setInterval(fetchData, 60_000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [endpoint, range]);

    return state;
}
