---
title: Cache guide
---

# Caching

Import from `@neutrium/utilities/cache` or the package root.

## Choosing a cache

| API | Use |
| --- | --- |
| `LruCache<K, V>(maxEntries = 1024)` | Bound a cache by entry count. |
| `WeightedLruCache<K, V>({ maxEntries?, maxWeight, weigh })` | Bound by both entry count and application-defined weight. |
| `BudgetCache<V>(config, policy)` | String-keyed retention with estimated byte accounting and optional admission/copy hooks. |
| `WeakCacheRegistry<K extends object, V>(create)` | Lazily associate values with a configuration, constructor or other object identity. |

`LruCache` also accepts the weighted options object. `WeightedLruCache` names that use explicitly and requires a weight limit and measurement callback.

## Bounded-cache contract

- Entry and weight limits must be nonnegative safe integers. Zero for either limit disables retention, even for zero-weight entries. Weighted caches default to 1024 entries.
- `set(key, value)` returns the cache for chaining. `trySet(key, value)` returns `true` if retained, `false` if disabled, oversized or rejected by an admission hook.
- A successful `get`, `set` or `trySet` makes the entry most recently used. `peek`, `has` and failed reads or insertions do not change recency.
- Eviction removes least-recently-used entries until **both** limits are satisfied. A replacement removes its old weight before accounting for the new value.
- Rejected entries and throwing callbacks leave existing values, accounting and recency unchanged. An oversized replacement does not discard the old value.
- `undefined` is a valid stored value. `get` and `peek` return `undefined` for a miss too; use `has` to distinguish them. LRU keys follow native Map identity semantics, including object identity, `NaN`, and equivalent `0` / `-0` keys.
- `delete` returns whether an entry existed. `clear` resets contents and weight. `keys()` iterates least to most recently used. Do not mutate recency while iterating unless native Map live-iterator behaviour is intended.
- `size` counts entries. `weight` is the sum of admitted weights (entry count in an unweighted LRU). `stats` returns a frozen snapshot, not a live object.
- Configuration limits and callback references are captured at construction. Limits cannot be changed afterwards; construct a new cache to change them.
- Values are retained by reference unless a BudgetCache `detach` callback copies them. Weight is measured on insertion, not on subsequent mutation or reads.
- Callbacks are synchronous and must not mutate the cache. Errors propagate to the caller. There is no TTL, timer, asynchronous loader or implicit promise retry.

```ts
import { LruCache, WeightedLruCache } from '@neutrium/utilities/cache';

const formats = new LruCache<string, Intl.NumberFormat>(128);
formats.set('en-AU', new Intl.NumberFormat('en-AU'));
const formatter = formats.get('en-AU');

const buffers = new WeightedLruCache<string, Uint8Array>({
    maxEntries: 64,
    maxWeight: 1024 * 1024,
    weigh: (_key, buffer) => buffer.byteLength,
});
buffers.trySet('sample', new Uint8Array(512)); // true
```

`CacheStats` exposes `entries`, `weight`, `maxEntries`, and `maxWeight`. Unweighted caches report `Infinity` for `maxWeight`. Weight units are chosen by the caller; they need not represent bytes. A zero-weight entry still consumes one entry slot.

## Estimated memory budgets

```ts
import { BudgetCache, cacheConfig } from '@neutrium/utilities/cache';

type Plan = { tokens: readonly string[] };
const plans = new BudgetCache<Plan>(cacheConfig({
    maxEntries: 256,
    maxBytes: 1024 * 1024,
}), {
    accept: key => key.length <= 4096,
    measure: plan => 64 + plan.tokens.reduce((bytes, token) => bytes + 32 + 2 * token.length, 0),
    detach: plan => ({ tokens: [...plan.tokens] }),
});

plans.trySet('m / s', { tokens: ['m', '/', 's'] });
plans.stats.estimatedBytes;
```

Cost is `entryOverheadBytes + 2 * key.length + measure(value)`. The default entry overhead is 256 bytes; override it in the policy when appropriate. `maxBytes` defaults to 4 MiB and `maxEntries` defaults to 1024. These are **estimates**, not guarantees about JavaScript heap usage, backing strings, shared buffers, or garbage collection. Provide domain-specific payload measurements in the consuming library.

Admission order is: disabled check, `accept`, key cost check, `measure`, total cost check, `detach`, then insertion/eviction. Rejected entries never invoke `detach`. The detached value must have the measured size. Strings and keys receive no engine-specific backing-store detachment guarantee. The example copies the token
array but does not promise to copy the strings' backing storage.

Storage is allocated on first admission and released by `clear`. If the owner wants an optional cache, `BudgetCache.create(config, policy)` returns `undefined` when either validated limit is zero. Construction still validates the policy.

Policies may be objects or class instances with inherited methods. Callback references and entry overhead are captured at construction. Callbacks run with the original policy as `this`, including access to private fields; policy state remains shared and mutable. Replacing a callback later does not change the cache's captured callback.

`cacheConfig(input?, parent?)` validates, copies and freezes limits. Undefined fields inherit the parent's limits (or `DEFAULT_CACHE_CONFIG`); unknown own keys, including symbols, are rejected. Configuration uses the shared `resolveConfig` helper; inputs must be plain records with data properties. Accessors and class instances are rejected. `BudgetCacheStats` exposes `entries`, `estimatedBytes`, `maxEntries`, and `maxBytes`; the cache's `weight` property is its estimated byte count.

## Weak identity scopes

```ts
import { LruCache, WeakCacheRegistry } from '@neutrium/utilities/cache';

const scopes = new WeakCacheRegistry((config: { precision: number }) =>
    new LruCache<string, string>(128));
const config = { precision: 20 };
scopes.get(config).set('expression', 'result');
scopes.get(config); // same cache
scopes.get({ precision: 20 }); // different cache: different identity
scopes.delete(config); // next get(config) creates a new cache
scopes.clear(); // invalidate every association
```

`get` creates on a miss; `peek` and `has` never create. Factories receive the key and may return any value, including `undefined`. A thrown factory error is not cached. Recursive creation for the same key throws; creation for another key is allowed. Object and function keys are accepted; primitive keys are rejected by `get`. `has`, `peek`, and `delete` follow WeakMap read behaviour for invalid JavaScript keys.

`clear` replaces the internal WeakMap. Previously returned values remain valid, but future calls create new associations. A factory that calls `clear` returns its value without retaining it in the new generation. Promise values are retained as-is, including rejected promises; this is not an asynchronous retry mechanism.

There is no size, enumeration or guarantee of when entries will be garbage-collected. Keys are weakly held. For mutable configuration objects, invalidate the association when changing settings, or use immutable configuration identities.

For decimal constants, cache the template by constructor identity and keep cloning it before exposing it to callers. The registry does not clone cached values.

## Migrating Neutrium consumers

- Quantity LRU: use `new WeightedLruCache({ maxEntries, maxWeight, weigh })` in place   of its two-argument weighted constructor. Invalid limits now throw. Rejected replacements preserve existing entries.
- Formatter LRU: `set` now returns the cache, not the value. Store a constructed formatter in a local variable if it must also be returned. Zero capacity disables retention rather than throwing.
- Quantity BudgetCache: use `trySet` where the old boolean `set` result is needed. Keep unit-specific measurements and text ownership policies in quantity.
- Quantity WeakCacheRegistry: the existing `get` / `clear` pattern is supported; `peek`, `has`, and `delete` add targeted inspection and invalidation.
