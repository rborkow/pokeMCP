import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SavedWorkspaceExport } from "@/components/site/SavedWorkspaceExport";

function stubLocalStorage(values: Record<string, string>) {
    vi.stubGlobal("localStorage", {
        getItem: (key: string) => values[key] ?? null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
    });
}

describe("SavedWorkspaceExport", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("says so when the browser holds nothing from the retired app", async () => {
        stubLocalStorage({});
        render(<SavedWorkspaceExport />);
        expect(
            await screen.findByText("Nothing from PokeMCP Prep is saved in this browser."),
        ).toBeInTheDocument();
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("ignores an empty leftover store", async () => {
        stubLocalStorage({
            "pokemcp-prep-workspace": JSON.stringify({ state: { teams: [], plans: [] } }),
            "pokemcp-team": JSON.stringify({ state: { team: [] } }),
        });
        render(<SavedWorkspaceExport />);
        expect(
            await screen.findByText("Nothing from PokeMCP Prep is saved in this browser."),
        ).toBeInTheDocument();
    });

    it("offers a download when a saved team or plan is found", async () => {
        stubLocalStorage({
            "pokemcp-team": JSON.stringify({ state: { team: [{ pokemon: "Kingambit" }] } }),
        });
        render(<SavedWorkspaceExport />);
        expect(
            await screen.findByRole("button", { name: /Download saved teams and plans/ }),
        ).toBeInTheDocument();
    });

    it("treats blocked storage as nothing saved", async () => {
        vi.stubGlobal("localStorage", {
            getItem: () => {
                throw new Error("blocked");
            },
        });
        render(<SavedWorkspaceExport />);
        expect(
            await screen.findByText("Nothing from PokeMCP Prep is saved in this browser."),
        ).toBeInTheDocument();
    });
});
