import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { getOpenAiChallengeResponse, OPENAI_CHALLENGE_PATH } from "../domain-verification.js";

describe("OpenAI domain verification", () => {
    it("returns exactly the token as plain text", async () => {
        const response = getOpenAiChallengeResponse(OPENAI_CHALLENGE_PATH, "GET", "abc-123");
        assert.equal(response?.status, 200);
        assert.match(response?.headers.get("Content-Type") ?? "", /^text\/plain/);
        assert.equal(response?.headers.get("Cache-Control"), "no-store");
        assert.equal(await response.text(), "abc-123");
    });

    it("strips whitespace pasted around the token", async () => {
        const response = getOpenAiChallengeResponse(OPENAI_CHALLENGE_PATH, "GET", "  abc-123\n");
        assert.equal(await response.text(), "abc-123");
    });

    it("does not answer until a token is set", () => {
        assert.equal(getOpenAiChallengeResponse(OPENAI_CHALLENGE_PATH, "GET", undefined), null);
        assert.equal(getOpenAiChallengeResponse(OPENAI_CHALLENGE_PATH, "GET", "   "), null);
    });

    it("ignores other paths and methods", () => {
        assert.equal(getOpenAiChallengeResponse("/.well-known/other", "GET", "abc"), null);
        assert.equal(getOpenAiChallengeResponse(OPENAI_CHALLENGE_PATH, "POST", "abc"), null);
    });

    it("answers HEAD without a body", async () => {
        const response = getOpenAiChallengeResponse(OPENAI_CHALLENGE_PATH, "HEAD", "abc");
        assert.equal(response?.status, 200);
        assert.equal(await response.text(), "");
    });
});
