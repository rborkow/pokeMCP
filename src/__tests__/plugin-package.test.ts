import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CONNECTOR_TOOLS } from "../connector/tools.js";

// The ChatGPT plugin package in plugin/. Limits are OpenAI's submission limits
// (developers.openai.com/plugins/deploy/submission), checked here so a problem
// shows up in CI and not in the portal or in review.
const manifest = JSON.parse(readFileSync("plugin/plugin.json", "utf8"));
const mcp = JSON.parse(readFileSync("plugin/mcp.json", "utf8"));
const openai = manifest.extensions["com.openai"];
const listing = openai.interface;
const toolNames = new Set(CONNECTOR_TOOLS.map((tool) => tool.name));

function pngSize(path: string): { width: number; height: number } {
    const bytes = readFileSync(path);
    assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], `${path} is a PNG`);
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("ChatGPT plugin package", () => {
    it("has a valid package identity", () => {
        assert.match(manifest.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
        assert.ok(manifest.name.length <= 64);
        assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
        assert.ok(manifest.description.length <= 4000);
    });

    it("keeps the listing text inside the submission limits", () => {
        assert.ok(listing.displayName.length <= 30, "displayName");
        assert.ok(listing.shortDescription.length <= 30, "shortDescription");
        assert.ok(listing.longDescription.length <= 4000, "longDescription");
        assert.ok(listing.developerName.length <= 80, "developerName");
        assert.ok(listing.capabilities.length <= 20);
        for (const capability of listing.capabilities) assert.ok(capability.length <= 120);

        const prompts: string[] = listing.defaultPrompt;
        assert.ok(prompts.length <= 3);
        assert.equal(new Set(prompts).size, prompts.length, "starter prompts are unique");
        for (const prompt of prompts) {
            assert.ok(prompt.length <= 128, `starter prompt too long: ${prompt}`);
            assert.doesNotMatch(prompt, /@/, "no @mentions in starter prompts");
        }
        assert.match(listing.brandColor, /^#[0-9A-F]{6}$/i);
    });

    it("links the four public pages an MCP review requires", () => {
        assert.equal(listing.websiteURL, "https://www.pokemcp.com");
        assert.equal(listing.supportURL, "https://www.pokemcp.com/support");
        assert.equal(listing.privacyPolicyURL, "https://www.pokemcp.com/privacy");
        assert.equal(listing.termsOfServiceURL, "https://www.pokemcp.com/terms");
    });

    it("says it is unofficial", () => {
        assert.match(listing.longDescription, /unofficial fan project/);
        assert.match(listing.longDescription, /not affiliated with or endorsed by Nintendo/);
    });

    it("ships square icons of at least 48 pixels", () => {
        for (const field of ["logo", "composerIcon"]) {
            const relative: string = listing[field];
            assert.match(relative, /^\.\//, `${field} is a ./-prefixed path`);
            const path = `plugin/${relative.slice(2)}`;
            assert.ok(existsSync(path), `${path} exists`);
            const { width, height } = pngSize(path);
            assert.equal(width, height, `${path} is square`);
            assert.ok(width >= 48 && width <= 4096, `${path} is 48 to 4096 pixels`);
        }
    });

    it("declares exactly one remote MCP server, the live connector", () => {
        const servers = Object.values(mcp.mcpServers) as { type: string; url: string }[];
        assert.equal(servers.length, 1);
        assert.equal(servers[0].url, "https://api.pokemcp.com/mcp");
        assert.equal(servers[0].type, "streamable-http");
    });

    it("has five positive review cases that name real connector tools", () => {
        const cases = openai.review.test_cases.positive;
        assert.equal(cases.length, 5);
        for (const testCase of cases) {
            assert.ok(testCase.description && testCase.prompt && testCase.expected_behavior);
            assert.ok(testCase.description.length <= 4000);
            const tools: string[] = testCase.tools_triggered
                .split(",")
                .map((t: string) => t.trim());
            assert.ok(tools.length > 0);
            for (const tool of tools) {
                assert.ok(toolNames.has(tool), `"${tool}" is not a connector tool`);
            }
        }
    });

    it("has three negative review cases", () => {
        const cases = openai.review.test_cases.negative;
        assert.equal(cases.length, 3);
        for (const testCase of cases) assert.ok(testCase.description && testCase.prompt);
    });

    it("carries nothing the portal rejects or that must stay private", () => {
        assert.equal(openai.review.test_credentials, undefined);
        assert.equal(openai.review.reviewer_instructions, undefined);
        assert.equal(manifest.apps, undefined, "app references cannot be submitted");
        assert.equal(manifest.hooks, undefined, "lifecycle hooks cannot be submitted");
    });
});
