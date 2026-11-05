/** Bounded public-stdio smoke across two independent server processes. */
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SAMPLE_TEAM_PASTE as ORIGINAL_SAMPLE } from "../src/team.js";
// Legacy sample includes Incineroar Knock Off, absent from this pinned Champions learnset.
const SAMPLE_TEAM_PASTE = ORIGINAL_SAMPLE.replace("- Knock Off", "- Darkest Lariat");

const root = mkdtempSync(join(tmpdir(), "champions-mcp-smoke-"));
const cwd = join(import.meta.dirname, "..");
type SmokeChild = ChildProcessByStdio<Writable, Readable, null>;
const children: SmokeChild[] = [];
let nextId = 1;
function start(): SmokeChild {
    const runtime = process.env.CHAMPIONS_SMOKE_RUNTIME || process.execPath;
    const args = runtime.endsWith("/bun")
        ? ["run", "bin/champions-mcp.ts"]
        : ["--import", "tsx", "bin/champions-mcp.ts"];
    const child = spawn(runtime, args, {
        cwd,
        env: { ...process.env, CHAMPIONS_MEMORY_ROOT: root },
        stdio: ["pipe", "pipe", "inherit"],
    });
    children.push(child);
    return child;
}
function rpc(child: SmokeChild, method: string, params?: unknown): Promise<any> {
    const id = nextId++;
    const timeout = setTimeout(() => reject(new Error(`RPC timeout: ${method}`)), 90_000);
    let buffer = "";
    let reject!: (e: Error) => void;
    const promise = new Promise<any>((resolve, r) => {
        reject = r;
        const onData = (chunk: Buffer) => {
            buffer += chunk.toString();
            for (;;) {
                const end = buffer.indexOf("\n");
                if (end < 0) return;
                const line = buffer.slice(0, end);
                buffer = buffer.slice(end + 1);
                if (!line) continue;
                const message = JSON.parse(line);
                if (message.id !== id) continue;
                clearTimeout(timeout);
                child.stdout.off("data", onData);
                resolve(message);
                return;
            }
        };
        child.stdout.on("data", onData);
        child.once("exit", () => {
            clearTimeout(timeout);
            reject(new Error(`server exited during ${method}`));
        });
    });
    child.stdin.write(
        JSON.stringify({
            jsonrpc: "2.0",
            id,
            method,
            ...(params === undefined ? {} : { params }),
        }) + "\n",
    );
    return promise;
}
function text(response: any): string {
    if (response.error || response.result?.isError)
        throw new Error(
            response.error?.message ?? response.result?.content?.[0]?.text ?? "MCP tool error",
        );
    return response.result.content[0].text;
}
async function stop(child: SmokeChild): Promise<void> {
    child.kill();
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
}
try {
    const a = start();
    const initialized = await rpc(a, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "memory-smoke", version: "2" },
    });
    if (initialized.error) throw new Error(initialized.error.message);
    a.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    const valid = text(
        await rpc(a, "tools/call", {
            name: "validate_team",
            arguments: { paste: SAMPLE_TEAM_PASTE },
        }),
    );
    if (!valid.includes("✅ Legal: 6 Pokémon, no problems."))
        throw new Error(`Smoke fixture failed validation: ${valid}`);
    const matchup = text(
        await rpc(a, "tools/call", {
            name: "simulate_matchup",
            arguments: {
                paste: SAMPLE_TEAM_PASTE,
                opponentPaste: SAMPLE_TEAM_PASTE,
                games: 1,
                seed: 9,
            },
        }),
    );
    const matchupId = /Run ID: `([^`]+)`/.exec(matchup)?.[1];
    if (!matchupId) throw new Error("matchup did not return a run ID");
    const evaluation = text(
        await rpc(a, "tools/call", {
            name: "evaluate_team",
            arguments: { paste: SAMPLE_TEAM_PASTE, gamesPerOpponent: 1, maxOpponents: 1, seed: 9 },
        }),
    );
    const evaluationId = /Run ID: `([^`]+)`/.exec(evaluation)?.[1];
    if (!evaluationId) throw new Error("evaluation did not return a run ID");
    const finding = text(
        await rpc(a, "tools/call", {
            name: "record_finding",
            arguments: {
                claim: "stdio smoke only",
                regulation: "champions-regmc",
                evidenceRunIds: [matchupId],
                limitations: "one-game test-only heuristic smoke",
                status: "hypothesis",
                testOnly: true,
            },
        }),
    );
    if (!finding.includes("findingId")) throw new Error("finding was not recorded");
    await stop(a);
    const b = start();
    const initializedB = await rpc(b, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "memory-smoke-replay", version: "2" },
    });
    if (initializedB.error) throw new Error(initializedB.error.message);
    b.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    for (const id of [matchupId, evaluationId]) {
        const replay = JSON.parse(
            text(await rpc(b, "tools/call", { name: "replay_run", arguments: { runId: id } })),
        );
        if (replay.status !== "verified") throw new Error(`replay ${id}: ${replay.status}`);
    }
    const findings = text(
        await rpc(b, "tools/call", {
            name: "list_findings",
            arguments: { regulation: "champions-regmc", includeTestOnly: true },
        }),
    );
    if (!JSON.parse(findings).items.some((x: any) => x.testOnly && x.evidenceWarnings.length === 0))
        throw new Error("finding readback/evidence verification failed");
    await stop(b);
    console.log(
        `memory stdio smoke passed: processes=2 matchup=${matchupId} evaluation=${evaluationId}`,
    );
} finally {
    for (const child of children) if (!child.killed) child.kill();
    rmSync(root, { recursive: true, force: true });
}
