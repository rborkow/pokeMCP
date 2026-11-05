import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { FakeJev, HttpJev, jevAvailable, makeJev } from "./client.js";

describe("jev client", () => {
    it("reports availability from the env", () => {
        assert.equal(typeof jevAvailable(), "boolean");
    });
    it("fake returns the canned answers and records the request", async () => {
        const jev = new FakeJev({
            cause: {
                type: "choice",
                choice: "wrong_lead",
                probabilities: { wrong_lead: 0.7, hax: 0.3 },
                confidence: 0.7,
            },
        });
        const r = await jev.ask(
            { log: "x" },
            {
                cause: {
                    type: "choice",
                    instructions: "why",
                    criteria: { wrong_lead: null, hax: null },
                },
            },
        );
        assert.equal(r.cause.type, "choice");
        if (r.cause.type === "choice") assert.equal(r.cause.choice, "wrong_lead");
        assert.equal(jev.calls.length, 1);
        assert.equal(makeJev({ fake: jev }), jev);
    });
    it("http client builds the documented request body and retries on 529", async () => {
        const seen: { url: string; body: unknown; auth: string | null }[] = [];
        let n = 0;
        const fetchImpl: typeof fetch = async (url, init) => {
            seen.push({
                url: String(url),
                body: JSON.parse(String(init?.body)),
                auth: new Headers(init?.headers).get("authorization"),
            });
            n++;
            if (n === 1) return new Response("overloaded", { status: 529 });
            return Response.json({
                model: "jev-latest",
                answers: { ok: { type: "noul", noul: 0.9 } },
                usage: { input_tokens: 1, output_tokens: 1 },
            });
        };
        const jev = new HttpJev("test-key", { fetchImpl, backoffMs: [1, 1, 1] });
        const r = await jev.ask("state", { ok: { type: "noul", instructions: "ok?" } });
        assert.equal(seen.length, 2);
        assert.equal(seen[0].url, "https://api.typesafe.ai/v1/systemone");
        assert.equal(seen[0].auth, "Bearer test-key");
        assert.deepEqual(seen[0].body, {
            state: "state",
            model: "jev-latest",
            questions: { ok: { type: "noul", instructions: "ok?" } },
        });
        assert.equal(r.ok.type, "noul");
        if (r.ok.type === "noul") assert.equal(r.ok.noul, 0.9);
    });
});
