import { render } from "preact";
import "../../shared/base.css";
import { useMcpApp } from "../../shared/useMcpApp.js";
import "./type-chart.css";
import { TypeChart } from "./TypeChart.js";
import type { TypeChartData } from "./types.js";

function App() {
    const state = useMcpApp<TypeChartData>("VGC Teambuilder type chart");
    if (state.status === "ready") return <TypeChart data={state.data} />;
    if (state.status === "error") return <p class="view-status">{state.message}</p>;
    return <p class="view-status">Loading the type chart…</p>;
}

render(<App />, document.getElementById("root") as HTMLElement);
