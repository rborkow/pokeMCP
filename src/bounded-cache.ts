/**
 * A small in-memory cache with an expiry time and a hard cap on entries.
 *
 * Module-level caches live as long as the Workers isolate, which every MCP
 * session on a machine shares and which has a 128 MB memory limit. A cache
 * that only checks age on read never gives memory back: a busy Pokémon's usage
 * record is several hundred kilobytes, so caching every one that is ever asked
 * for can use most of that limit. This cache drops expired entries and, when
 * full, the entry that was used longest ago.
 */
export class BoundedTtlCache<T> {
    // A Map iterates in insertion order, so the first key is the least recently used.
    private readonly entries = new Map<string, { data: T; expiresAt: number }>();

    constructor(
        private readonly maxEntries: number,
        private readonly ttlMs: number,
    ) {}

    get(key: string, now = Date.now()): T | undefined {
        const hit = this.entries.get(key);
        if (!hit) return undefined;
        if (now >= hit.expiresAt) {
            this.entries.delete(key);
            return undefined;
        }
        // Re-insert so this key becomes the most recently used.
        this.entries.delete(key);
        this.entries.set(key, hit);
        return hit.data;
    }

    set(key: string, data: T, now = Date.now()): void {
        this.entries.delete(key);
        for (const [existingKey, entry] of this.entries) {
            if (now >= entry.expiresAt) this.entries.delete(existingKey);
        }
        this.entries.set(key, { data, expiresAt: now + this.ttlMs });
        while (this.entries.size > this.maxEntries) {
            const oldest = this.entries.keys().next().value;
            if (oldest === undefined) break;
            this.entries.delete(oldest);
        }
    }

    get size(): number {
        return this.entries.size;
    }
}
