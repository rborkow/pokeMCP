/**
 * MCP Apps views: interactive HTML that hosts such as Claude and ChatGPT
 * render beside a tool's result. Each view is one self-contained document
 * built from apps/mcp-views into view-html.ts and served by `resources/read`
 * at a `ui://` URI that carries a hash of its HTML.
 *
 * Views are an enhancement. A tool with a view returns the same Markdown text
 * and `structuredContent` as before, so a host without MCP Apps support, and
 * the model itself, lose nothing.
 *
 * The extension's spec says a server SHOULD offer UI metadata only to clients
 * that advertise the extension. This server can't: it is stateless and marks
 * `tools/list` publicly cacheable, so every caller must get the same list.
 * Hosts that don't support the extension ignore `_meta.ui`, which the spec
 * allows.
 */

import { RESOURCE_MIME_TYPE, registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { VIEW_HTML, type ViewName } from "./view-html.js";

export type { ViewName };

/** The MCP Apps extension id, as servers and clients advertise it. */
export const UI_EXTENSION_ID = "io.modelcontextprotocol/ui";

/** Directory-facing description of each view, shown by hosts that list resources. */
const VIEW_INFO: Record<ViewName, { title: string; description: string }> = {
    "type-chart": {
        title: "Defensive type chart",
        description:
            "Chart of how each attacking type hits each team member, from analyze_team_types.",
    },
};

/**
 * Whether this deployment serves views. Off unless the Worker's `MCP_APPS`
 * variable is "on", so production can ship the code before the views are
 * turned on (and turn them off again without a deploy of new code).
 */
export function viewsEnabled(env: Pick<Env, "MCP_APPS"> | undefined): boolean {
    return env?.MCP_APPS === "on";
}

/** The resource URI for a view. Changes whenever the view's HTML changes. */
export function viewUri(view: ViewName): string {
    return `ui://vgc-teambuilder/${view}-${VIEW_HTML[view].hash}.html`;
}

/** `_meta` for a tool that renders with a view. */
export function viewToolMeta(view: ViewName): Record<string, unknown> {
    const resourceUri = viewUri(view);
    // The flat "ui/resourceUri" key is the extension's older spelling, still
    // read by some hosts; ext-apps' registerAppTool sets both the same way.
    return { ui: { resourceUri }, "ui/resourceUri": resourceUri };
}

/** Register every view as a `ui://` resource. */
export function registerViews(server: McpServer): void {
    for (const view of Object.keys(VIEW_HTML) as ViewName[]) {
        const uri = viewUri(view);
        const info = VIEW_INFO[view];
        registerAppResource(
            server,
            info.title,
            uri,
            {
                description: info.description,
                // Views load nothing from outside the document: no fonts,
                // images or scripts from other domains, and no fetches. An
                // empty CSP list keeps the host's strictest default.
                _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
            },
            async () => ({
                contents: [
                    {
                        uri,
                        mimeType: RESOURCE_MIME_TYPE,
                        text: VIEW_HTML[view].html,
                        _meta: {
                            ui: {
                                csp: { connectDomains: [], resourceDomains: [] },
                                prefersBorder: true,
                            },
                        },
                    },
                ],
            }),
        );
    }
}
