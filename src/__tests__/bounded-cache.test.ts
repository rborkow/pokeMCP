import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BoundedTtlCache } from "../bounded-cache.js";
import { getPokemonStats } from "../stats.js";

describe("bounded cache", () => {
    it("returns a stored value until it expires, then forgets it", () => {
        const cache = new BoundedTtlCache<string>(4, 1000);
        cache.set("a", "one", 0);
        assert.equal(cache.get("a", 999), "one");
        assert.equal(cache.get("a", 1000), undefined);
        assert.equal(cache.size, 0, "an expired entry is removed, not just hidden");
    });

    it("never holds more than its cap, dropping the least recently used entry", () => {
        const cache = new BoundedTtlCache<number>(3, 60_000);
        cache.set("a", 1, 0);
        cache.set("b", 2, 1);
        cache.set("c", 3, 2);
        cache.get("a", 3); // a is now the most recently used
        cache.set("d", 4, 4);

        assert.equal(cache.size, 3);
        assert.equal(cache.get("b", 5), undefined, "b was used longest ago");
        assert.equal(cache.get("a", 5), 1);
        assert.equal(cache.get("c", 5), 3);
        assert.equal(cache.get("d", 5), 4);
    });

    it("clears expired entries when a new one is stored", () => {
        const cache = new BoundedTtlCache<number>(10, 100);
        cache.set("old-1", 1, 0);
        cache.set("old-2", 2, 0);
        cache.set("new", 3, 500);
        assert.equal(cache.size, 1);
    });

    it("replaces a value stored under the same key", () => {
        const cache = new BoundedTtlCache<number>(2, 1000);
        cache.set("a", 1, 0);
        cache.set("a", 2, 1);
        assert.equal(cache.size, 1);
        assert.equal(cache.get("a", 2), 2);
    });
});

describe("usage statistics cache", () => {
    it("re-reads a Pokémon that was pushed out instead of growing without limit", async () => {
        let reads = 0;
        const env = {
            POKEMON_STATS: {
                async get(key: string) {
                    reads++;
                    return { displayName: key, usage: 0.1 };
                },
            },
        } as unknown as Env;
        const format = "bounded-cache-test";

        await getPokemonStats("first", format, env);
        await getPokemonStats("first", format, env);
        assert.equal(reads, 1, "a repeat lookup is served from memory");

        // Far more distinct Pokémon than the cache may hold.
        for (let i = 0; i < 200; i++) await getPokemonStats(`filler${i}`, format, env);
        const before = reads;
        await getPokemonStats("first", format, env);
        assert.equal(reads, before + 1, "the first entry was evicted, so it is read again");
    });
});
