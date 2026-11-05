/**
 * Jev (TypeSafe "System One") HTTP client — raw fetch, no SDK dependency.
 * Wire shape per https://docs.typesafe.ai/api.md:
 *   POST https://api.typesafe.ai/v1/systemone
 *   Authorization: Bearer <TYPESAFE_API_KEY>
 *   body { state, model: "jev-latest", questions: { id: Question } }
 *   resp { model, answers: { id: Answer }, usage: { input_tokens, output_tokens } }
 */

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

export type Question =
    | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
    | { type: "choice"; instructions: string; criteria: Record<string, string | null> }
    | { type: "score"; instructions: string; criteria: string[] };

export type Answer =
    | { type: "noul"; noul: number }
    | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
    | {
          type: "score";
          score: number;
          legend: string[];
          probabilities: Record<string, number>;
          confidence: number;
      };

export interface Jev {
    ask(state: unknown, questions: Record<string, Question>): Promise<Record<string, Answer>>;
}

export interface JevUsage {
    input_tokens: number;
    output_tokens: number;
}

/** True when a live Jev is configured. */
export function jevAvailable(): boolean {
    return Boolean(process.env.TYPESAFE_API_KEY);
}

/** Offline stand-in: replays canned answers and records every request. */
export class FakeJev implements Jev {
    public calls: { state: unknown; questions: Record<string, Question> }[] = [];

    constructor(public answers: Record<string, Answer>) {}

    async ask(
        state: unknown,
        questions: Record<string, Question>,
    ): Promise<Record<string, Answer>> {
        this.calls.push({ state, questions });
        return this.answers;
    }
}

interface JevHttpOptions {
    model?: string;
    fetchImpl?: typeof fetch;
    backoffMs?: number[];
    timeoutMs?: number;
}

const RETRY_STATUSES = new Set([429, 529]);

export class HttpJev implements Jev {
    private model: string;
    private fetchImpl: typeof fetch;
    private backoffMs: number[];
    private timeoutMs: number;
    /** Usage of the most recent successful call, for tool cost footers. */
    public lastUsage?: JevUsage;

    constructor(
        private apiKey: string,
        opts: JevHttpOptions = {},
    ) {
        this.model = opts.model ?? process.env.JEV_MODEL ?? "jev-latest";
        this.fetchImpl = opts.fetchImpl ?? fetch;
        this.backoffMs = opts.backoffMs ?? [1000, 2000, 4000];
        this.timeoutMs = opts.timeoutMs ?? 30_000;
    }

    async ask(
        state: unknown,
        questions: Record<string, Question>,
    ): Promise<Record<string, Answer>> {
        const body = JSON.stringify({ state, model: this.model, questions });
        let lastError: Error = new Error("Jev: no attempt made");
        for (let attempt = 0; attempt <= this.backoffMs.length; attempt++) {
            if (attempt > 0) await sleep(this.backoffMs[attempt - 1]);
            let response: Response;
            try {
                response = await this.fetchImpl(JEV_ENDPOINT, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body,
                    signal: AbortSignal.timeout(this.timeoutMs),
                });
            } catch (error) {
                // Network/timeout failure: retry on the backoff schedule too.
                lastError = error instanceof Error ? error : new Error(String(error));
                continue;
            }
            if (RETRY_STATUSES.has(response.status)) {
                lastError = new Error(
                    `Jev HTTP ${response.status}: ${(await safeText(response)).slice(0, 300)}`,
                );
                continue;
            }
            if (!response.ok) {
                throw new Error(
                    `Jev HTTP ${response.status}: ${(await safeText(response)).slice(0, 300)}`,
                );
            }
            const payload = (await response.json()) as {
                answers?: unknown;
                usage?: { input_tokens?: number; output_tokens?: number };
            };
            if (!isRecord(payload.answers)) {
                throw new Error("Jev response missing an `answers` object");
            }
            for (const [id, answer] of Object.entries(payload.answers)) {
                if (!isRecord(answer) || typeof answer.type !== "string") {
                    throw new Error(`Jev answer "${id}" is missing a \`type\``);
                }
            }
            if (typeof payload.usage?.input_tokens === "number") {
                this.lastUsage = {
                    input_tokens: payload.usage.input_tokens,
                    output_tokens: payload.usage.output_tokens ?? 0,
                };
            }
            return payload.answers as unknown as Record<string, Answer>;
        }
        throw lastError;
    }
}

/** The fake wins when given; otherwise a live client when the key is set; else null. */
export function makeJev(opts: { fake?: Jev } = {}): Jev | null {
    if (opts.fake) return opts.fake;
    const key = process.env.TYPESAFE_API_KEY;
    if (!key) return null;
    return new HttpJev(key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function safeText(response: Response): Promise<string> {
    try {
        return await response.text();
    } catch {
        return "<unreadable body>";
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
