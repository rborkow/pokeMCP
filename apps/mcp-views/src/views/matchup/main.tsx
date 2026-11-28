import { render } from "preact";
import "../../shared/base.css";
import { useMcpApp } from "../../shared/useMcpApp.js";
import "./matchup.css";
import { Matchup } from "./Matchup.js";
import { isMatchupData, type MatchupData } from "./types.js";

function App() {
    const state = useMcpApp<MatchupData>("VGC Teambuilder matchup plan");
    if (state.status === "ready") {
        if (isMatchupData(state.data)) return <Matchup data={state.data} />;
        return <p class="view-status">This result has no matchup plan to show.</p>;
    }
    if (state.status === "error") return <p class="view-status">{state.message}</p>;
    return <p class="view-status">Loading the matchup plan…</p>;
}

render(<App />, document.getElementById("root") as HTMLElement);
