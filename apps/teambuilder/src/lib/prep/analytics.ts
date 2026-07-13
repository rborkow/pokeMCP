export type PrepAnalyticsEvent =
    | "newsroom_view"
    | "event_team_selected"
    | "prep_started"
    | "prep_generated"
    | "plan_exported"
    | "coach_followup";

export function trackPrepEvent(
    event: PrepAnalyticsEvent,
    properties: { format?: string; source?: string; value?: number } = {},
) {
    const body = JSON.stringify({ event, ...properties });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/prep/analytics", new Blob([body], { type: "application/json" }));
        return;
    }
    void fetch("/api/prep/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
    });
}
