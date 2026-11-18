/**
 * Renders a view's component with fixture data, outside any host, so views
 * can be checked and screenshotted in both themes. Not part of any build the
 * Worker serves.
 */
import { applyDocumentTheme } from "@modelcontextprotocol/ext-apps";
import { render } from "preact";
import "../shared/base.css";
import "../views/type-chart/type-chart.css";
import { TYPE_CHART_FIXTURE } from "../views/type-chart/fixture.js";
import { TypeChart } from "../views/type-chart/TypeChart.js";

const params = new URLSearchParams(location.search);
applyDocumentTheme(params.get("theme") === "dark" ? "dark" : "light");
document.body.style.background = "var(--color-background-primary)";

const VIEWS: Record<string, () => preact.JSX.Element> = {
    "type-chart": () => <TypeChart data={TYPE_CHART_FIXTURE} />,
};

const view = VIEWS[params.get("view") ?? "type-chart"];
render(
    view ? view() : <p>Unknown view</p>,
    document.getElementById("root") as HTMLElement,
);
