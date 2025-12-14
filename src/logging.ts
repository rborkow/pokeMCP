/**
 * Anonymized interaction logging for fine-tuning data collection
 *
 * Privacy principles:
 * - No user identifiers (IP, session, user agent)
 * - No persistent tracking across requests
 * - Sampling to reduce data volume
 * - Sanitization of potentially identifying content
 */

export interface InteractionLog {
    // Metadata
    id: string;
    timestamp: number;

    // Tool interaction
    tool: string;
    args: Record<string, unknown>;
    response: string;
    responseTimeMs: number;
    success: boolean;

    // Context (for fine-tuning)
    format?: string;
    pokemonMentioned?: string[];
}

interface LoggerConfig {
    sampleRate: number;  // 0.0 to 1.0 (e.g., 0.1 = 10% of requests)
    maxResponseLength: number;
    enabled: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
    sampleRate: 0.1,  // Log 10% of interactions
    maxResponseLength: 4000,  // Truncate long responses
    enabled: true,
};

/**
 * Sanitize tool arguments to remove potential PII
 */
function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...args };

    // Pokemon nicknames might contain personal info - remove them
    if ('nickname' in sanitized) {
        delete sanitized.nickname;
    }

    // Team data might have nicknames
    if ('team' in sanitized && Array.isArray(sanitized.team)) {
        sanitized.team = (sanitized.team as Array<Record<string, unknown>>).map(pokemon => {
            const { nickname, ...rest } = pokemon as Record<string, unknown>;
            return rest;
        });
    }

    return sanitized;
}

/**
 * Extract Pokemon names mentioned in the interaction
 */
function extractPokemonMentioned(args: Record<string, unknown>, response: string): string[] {
    const mentioned = new Set<string>();

    // From args
    if (typeof args.pokemon === 'string') {
        mentioned.add(args.pokemon);
    }
    if (Array.isArray(args.team)) {
        for (const p of args.team) {
            if (typeof p === 'object' && p && 'pokemon' in p) {
                mentioned.add(String(p.pokemon));
            }
        }
    }

    // Could also parse response for Pokemon names, but keeping it simple for now

    return Array.from(mentioned).slice(0, 10);  // Limit to 10
}

/**
 * Truncate response to max length
 */
function truncateResponse(response: string, maxLength: number): string {
    if (response.length <= maxLength) {
        return response;
    }
    return response.slice(0, maxLength) + '... [truncated]';
}

/**
 * Generate a random ID that doesn't leak timing information
 */
function generateLogId(): string {
    // Use crypto.randomUUID() which doesn't contain timestamps
    return crypto.randomUUID();
}

/**
 * Determine if this request should be sampled
 */
function shouldSample(sampleRate: number): boolean {
    return Math.random() < sampleRate;
}

/**
 * Main logging function - call after tool execution
 */
export async function logInteraction(
    env: Env,
    tool: string,
    args: Record<string, unknown>,
    response: string,
    responseTimeMs: number,
    success: boolean,
    config: Partial<LoggerConfig> = {}
): Promise<void> {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Check if logging is enabled
    if (!cfg.enabled) return;

    // Check if R2 bucket is configured
    if (!env.INTERACTION_LOGS) {
        // R2 not configured, silently skip
        return;
    }

    // Sampling - only log a percentage of requests
    if (!shouldSample(cfg.sampleRate)) {
        return;
    }

    try {
        const log: InteractionLog = {
            id: generateLogId(),
            timestamp: Date.now(),
            tool,
            args: sanitizeArgs(args),
            response: truncateResponse(response, cfg.maxResponseLength),
            responseTimeMs,
            success,
            format: typeof args.format === 'string' ? args.format : undefined,
            pokemonMentioned: extractPokemonMentioned(args, response),
        };

        // Store in R2 with a path structure that makes it easy to query
        // Format: logs/YYYY/MM/DD/HH/{id}.json
        const now = new Date();
        const path = [
            'logs',
            now.getUTCFullYear(),
            String(now.getUTCMonth() + 1).padStart(2, '0'),
            String(now.getUTCDate()).padStart(2, '0'),
            String(now.getUTCHours()).padStart(2, '0'),
            `${log.id}.json`
        ].join('/');

        await env.INTERACTION_LOGS.put(path, JSON.stringify(log), {
            httpMetadata: {
                contentType: 'application/json',
            },
        });
    } catch (error) {
        // Don't let logging errors affect the main request
        console.error('Failed to log interaction:', error);
    }
}

/**
 * Wrapper to time and log a tool execution
 */
export async function withLogging<T extends string>(
    env: Env,
    tool: string,
    args: Record<string, unknown>,
    executor: () => Promise<T> | T,
    config?: Partial<LoggerConfig>
): Promise<T> {
    const startTime = performance.now();
    let success = true;
    let response: T;

    try {
        response = await executor();
    } catch (error) {
        success = false;
        response = `Error: ${error instanceof Error ? error.message : 'Unknown error'}` as T;
        throw error;
    } finally {
        const responseTimeMs = Math.round(performance.now() - startTime);

        // Log asynchronously - don't block the response
        // Use waitUntil if available in the context
        logInteraction(env, tool, args, response!, responseTimeMs, success, config);
    }

    return response;
}

/**
 * Get logging statistics (for monitoring)
 */
export async function getLoggingStats(env: Env): Promise<{
    enabled: boolean;
    bucketConfigured: boolean;
}> {
    return {
        enabled: DEFAULT_CONFIG.enabled,
        bucketConfigured: !!env.INTERACTION_LOGS,
    };
}

/**
 * Create a logged version of a tool handler for MCP
 * Use this to wrap tool implementations for automatic logging
 */
export function createLoggedToolHandler<TArgs extends Record<string, unknown>>(
    env: Env,
    toolName: string,
    handler: (args: TArgs) => Promise<string> | string,
    config?: Partial<LoggerConfig>
): (args: TArgs) => Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    return async (args: TArgs) => {
        const startTime = performance.now();
        let success = true;
        let result: string;

        try {
            result = await handler(args);
        } catch (error) {
            success = false;
            result = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            throw error;
        } finally {
            const responseTimeMs = Math.round(performance.now() - startTime);

            // Log asynchronously - fire and forget
            logInteraction(
                env,
                toolName,
                args as Record<string, unknown>,
                result!,
                responseTimeMs,
                success,
                config
            ).catch(err => console.error('Logging error:', err));
        }

        return {
            content: [{ type: 'text' as const, text: result }]
        };
    };
}
