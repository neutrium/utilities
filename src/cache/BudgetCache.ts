import { assertNonNegativeSafeInteger, assertPlainRecord } from '../validation/assertions.js';
import { resolveConfig } from '../configuration/index.js';
import { WeightedLruCache } from './LruCache.js';

/** Optional cache limits. Undefined fields inherit the parent configuration. */
export interface CacheConfigInput
{
	/** Maximum retained entries, a nonnegative safe integer. Zero disables retention. */
	maxEntries?: number;
	/** Maximum estimated retained bytes, a nonnegative safe integer. Zero disables retention. */
	maxBytes?: number;
}

/** Validated, immutable configuration with both limits specified. */
export type CacheConfig = Readonly<Required<CacheConfigInput>>;

/** Immutable snapshot of retained usage and configured byte and entry limits. */
export interface BudgetCacheStats extends CacheConfig
{
	/** Number of retained entries. */
	readonly entries: number;
	/** Total estimated bytes, including payloads, keys and per-entry overhead. */
	readonly estimatedBytes: number;
}

/**
 * Synchronous admission, size estimation and optional ownership-copy callbacks.
 * Methods may be inherited. Callback references are captured at construction and
 * invoked with the original policy as this; policy state is not copied or frozen.
 */
export interface CachePolicy<V>
{
	/** Estimated retained payload bytes, excluding the key and entry overhead. */
	measure(value: V): number;
	/** Reject before measuring or copying. Must not mutate this cache. */
	accept?(key: string, value: V): boolean;
	/** Optional ownership copy, called only after admission. Its size must match measure. */
	detach?(value: V): V;
	/** Estimated per-entry overhead; defaults to 256 bytes. */
	entryOverheadBytes?: number;
}

/** Frozen defaults: at most 1024 entries and 4 MiB of estimated retained bytes. */
export const DEFAULT_CACHE_CONFIG: CacheConfig = Object.freeze({ maxEntries: 1024, maxBytes: 4 * 1024 * 1024 });

/** Validate and copy limits. Undefined fields inherit defaults; unknown keys are rejected. */
export function cacheConfig(input: CacheConfigInput = {}, parent: CacheConfig = DEFAULT_CACHE_CONFIG): CacheConfig
{
	return resolveConfig({ maxEntries: parent.maxEntries, maxBytes: parent.maxBytes }, input, validateCacheConfig, 'cache');
}

function validateCacheConfig(value: unknown): asserts value is CacheConfig
{
	assertPlainRecord(value, 'cache');
	assertNonNegativeSafeInteger(value.maxEntries, 'maxEntries');
	assertNonNegativeSafeInteger(value.maxBytes, 'maxBytes');
}

/**
 * String-keyed LRU with estimated byte accounting, not a heap-memory guarantee.
 * Cost = entry overhead + two bytes per UTF-16 key code unit + measured payload.
 * Values remain caller-owned unless detach is supplied; do not mutate retained
 * values in a way that changes their measured size. Callbacks are synchronous.
 */
export class BudgetCache<V>
{
	private entries?: WeightedLruCache<string, { value: V; bytes: number }>;
	private readonly config: CacheConfig;
	private readonly policy: Readonly<CachePolicy<V>>;
	private readonly overhead: number;

	/** Validate limits and policy callbacks; allocate entry storage lazily on admission. */
	constructor(config: CacheConfigInput, policy: CachePolicy<V>)
	{
		this.config = cacheConfig(config);
		const { measure, accept, detach, entryOverheadBytes } = policy;

		if (typeof measure !== 'function')
		{
			throw new TypeError('measure must be a function');
		}

		for (const [name, callback] of [['accept', accept], ['detach', detach]] as const)
		{
			if (callback !== undefined && typeof callback !== 'function')
			{
				throw new TypeError(`${name} must be a function`);
			}
		}

		this.policy = Object.freeze({
			measure: measure.bind(policy),
			accept: accept?.bind(policy),
			detach: detach?.bind(policy),
		});

		this.overhead = entryOverheadBytes === undefined ? 256 : entryOverheadBytes;
		assertNonNegativeSafeInteger(this.overhead, 'entryOverheadBytes');
	}

	/** Optional owner storage: returns undefined when either validated limit is zero. */
	static create<V>(config: CacheConfigInput, policy: CachePolicy<V>): BudgetCache<V> | undefined
	{
		const cache = new BudgetCache(config, policy);

		return cache.enabled ? cache : undefined;
	}

	private get enabled(): boolean
	{
		return this.config.maxEntries > 0 && this.config.maxBytes > 0;
	}
	/** Number of currently retained entries. */
	get size(): number
	{
		return this.entries?.size ?? 0;
	}
	/** Total estimated retained bytes, including keys and entry overhead. */
	get weight(): number
	{
		return this.entries?.weight ?? 0;
	}
	/** Return a new frozen snapshot of usage and limits. */
	get stats(): BudgetCacheStats
	{
		return Object.freeze({ entries: this.size, estimatedBytes: this.weight, ...this.config });
	}
	/** Test membership without refreshing recency. */
	has(key: string): boolean
	{
		return this.entries?.has(key) ?? false;
	}
	/** Read a value without refreshing recency; missing keys return undefined. */
	peek(key: string): V | undefined
	{
		return this.entries?.peek(key)?.value;
	}
	/** Read a value and mark an existing entry most recently used. */
	get(key: string): V | undefined
	{
		return this.entries?.get(key)?.value;
	}
	/** Remove an entry and its accounted bytes; return whether it existed. */
	delete(key: string): boolean
	{
		return this.entries?.delete(key) ?? false;
	}
	/** Remove all entries and release the backing cache. */
	clear(): void
	{
		this.entries?.clear(); this.entries = undefined;
	}
	/** Iterate keys from least to most recently used without refreshing recency. */
	*keys(): IterableIterator<string>
	{
		if (this.entries)
		{
			yield* this.entries.keys();
		}
	}

	/** Chainable insertion; use trySet to observe admission or rejection. */
	set(key: string, value: V): this
	{
		this.trySet(key, value); return this;
	}

	/** Rejection or callback failure does not replace, evict, or refresh existing entries. */
	trySet(key: string, value: V): boolean
	{
		if (typeof key !== 'string')
		{
			throw new TypeError('BudgetCache keys must be strings');
		}

		if (!this.enabled || this.policy.accept?.(key, value) === false)
		{
			return false;
		}

		const keyBytes = this.overhead + 2 * key.length;

		if (!Number.isSafeInteger(keyBytes) || keyBytes > this.config.maxBytes)
		{
			return false;
		}

		const payloadBytes = this.policy.measure(value);
		assertNonNegativeSafeInteger(payloadBytes, 'payload bytes');

		if (payloadBytes > this.config.maxBytes - keyBytes)
		{
			return false;
		}

		const owned = this.policy.detach ? this.policy.detach(value) : value;

		this.entries ??= new WeightedLruCache({
			maxEntries: this.config.maxEntries,
			maxWeight: this.config.maxBytes,
			weigh: (_key, entry) => entry.bytes
		});

		return this.entries.trySet(key, { value: owned, bytes: keyBytes + payloadBytes });
	}
}
