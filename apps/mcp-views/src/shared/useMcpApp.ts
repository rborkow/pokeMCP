/**
 * Connect a view to its host and hand back the latest tool result.
 *
 * Every view follows the same lifecycle: register handlers, connect over
 * postMessage, then render from the tool's `structuredContent`. Views never
 * fetch data on load; the host pushes the result the model's tool call
 * produced.
 */
import {
    App,
    applyDocumentTheme,
    applyHostFonts,
    applyHostStyleVariables,
    type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import { useEffect, useState } from "preact/hooks";

export type ViewState<T> =
    | { status: "connecting" }
    | { status: "waiting"; app: App }
    | { status: "ready"; app: App; data: T }
    | { status: "error"; message: string };

function applyContext(context: McpUiHostContext | undefined): void {
    if (!context) return;
    if (context.theme) applyDocumentTheme(context.theme);
    if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
    if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
    if (context.safeAreaInsets) {
        const { top, right, bottom, left } = context.safeAreaInsets;
        document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
    }
}

export function useMcpApp<T>(name: string): ViewState<T> {
    const [state, setState] = useState<ViewState<T>>({ status: "connecting" });

    useEffect(() => {
        const app = new App({ name, version: "1.0.0" });

        // Handlers go on before connect(), or the first notification is lost.
        app.ontoolresult = (result) => {
            if (result.isError || !result.structuredContent) {
                // The model sees the tool's own error text; the view only
                // needs to stop waiting.
                setState({
                    status: "error",
                    message: "This result has nothing to chart. The text answer has the details.",
                });
                return;
            }
            setState({ status: "ready", app, data: result.structuredContent as T });
        };
        app.onhostcontextchanged = (context) => applyContext(context);
        app.onerror = (error) => console.error(error);

        app.connect()
            .then(() => {
                applyContext(app.getHostContext());
                setState((prev) => (prev.status === "connecting" ? { status: "waiting", app } : prev));
            })
            .catch(() =>
                setState({ status: "error", message: "This view couldn't connect to the chat." }),
            );
    }, [name]);

    return state;
}
