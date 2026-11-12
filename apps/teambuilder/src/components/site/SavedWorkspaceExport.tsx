"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

// Where the retired app kept a visitor's work in their browser. Read here
// directly, without the app's stores or schema, so the export keeps working
// after that code is gone.
const WORKSPACE_DATABASE = "pokemcp-prep";
const WORKSPACE_STORE = "workspace";
const WORKSPACE_KEY = "pokemcp-prep-workspace";
const BUILDER_TEAM_KEY = "pokemcp-team";

/** Read the saved workspace without creating the database if it never existed. */
function readWorkspace(): Promise<string | null> {
    return new Promise((resolve) => {
        if (typeof indexedDB === "undefined") return resolve(null);
        const request = indexedDB.open(WORKSPACE_DATABASE, 1);
        // Firing means there was no database: abort so this page does not leave one behind.
        request.onupgradeneeded = () => request.transaction?.abort();
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(WORKSPACE_STORE)) {
                database.close();
                return resolve(null);
            }
            const read = database
                .transaction(WORKSPACE_STORE, "readonly")
                .objectStore(WORKSPACE_STORE)
                .get(WORKSPACE_KEY);
            read.onsuccess = () => {
                database.close();
                resolve(typeof read.result === "string" ? read.result : null);
            };
            read.onerror = () => {
                database.close();
                resolve(null);
            };
        };
    });
}

function parse(raw: string | null): unknown {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}

/** True when a persisted store value actually holds something the visitor made. */
function hasContent(value: unknown): boolean {
    const state = (value as { state?: Record<string, unknown> } | null)?.state;
    if (!state) return false;
    return ["teams", "plans", "team"].some((key) => {
        const entry = state[key];
        return Array.isArray(entry) && entry.length > 0;
    });
}

type Saved = { workspace: unknown; builderTeam: unknown };

function download(saved: Saved) {
    const blob = new Blob(
        [JSON.stringify({ exportedAt: new Date().toISOString(), ...saved }, null, 2)],
        { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pokemcp-prep-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

export function SavedWorkspaceExport() {
    const [saved, setSaved] = useState<Saved | null | "checking">("checking");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            let local: string | null = null;
            let builder: string | null = null;
            try {
                local = localStorage.getItem(WORKSPACE_KEY);
                builder = localStorage.getItem(BUILDER_TEAM_KEY);
            } catch {
                // Storage can be blocked; treat it as nothing saved.
            }
            const workspace = parse((await readWorkspace()) ?? local);
            const builderTeam = parse(builder);
            if (cancelled) return;
            setSaved(
                hasContent(workspace) || hasContent(builderTeam)
                    ? { workspace, builderTeam }
                    : null,
            );
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (saved === "checking") {
        return <p className="text-sm text-muted-foreground">Checking this browser…</p>;
    }
    if (!saved) {
        return (
            <p className="text-sm text-muted-foreground">
                Nothing from PokeMCP Prep is saved in this browser.
            </p>
        );
    }

    return (
        <div>
            <p className="text-sm leading-6 text-muted-foreground">
                This browser still holds teams or plans you saved. Download them as a file; they
                stay in the browser until you clear its site data.
            </p>
            <button
                type="button"
                onClick={() => download(saved)}
                className="prep-button-secondary mt-4"
            >
                <Download className="h-4 w-4" aria-hidden="true" /> Download saved teams and plans
            </button>
        </div>
    );
}
