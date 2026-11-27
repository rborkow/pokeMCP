import { render } from "preact";
import "../../shared/base.css";
import { useMcpApp } from "../../shared/useMcpApp.js";
import "./type-chart.css";
import { TypeChart } from "./TypeChart.js";
import { isTypeChartData, type TypeChartData } from "./types.js";

function App() {
    const state = useMcpApp<TypeChartData>("VGC Teambuilder type chart");
    if (state.status === "ready") {
        if (isTypeChartData(state.data)) return <TypeChart data={state.data} />;
        return <p class="view-status">This result has no type chart to show.</p>;
    }
    if (state.status === "error") return <p class="view-status">{state.message}</p>;
    return <p class="view-status">Loading the type chart…</p>;
}

render(<App />, document.getElementById("root") as HTMLElement);
