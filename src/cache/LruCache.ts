import { assertNonNegativeSafeInteger } from '../validation/assertions.js';

/** Capacity and weight must be nonnegative safe integers; zero disables retention. */
export interface WeightedCacheOptions<K, V>
{
	/** Maximum retained entries; defaults to 1024. Zero disables retention. */
	maxEntries?: number;
	/** Maximum total weight in caller-defined units. Zero disables retention. */
	maxWeight: number;
	/** Return a nonnegative safe integer. Called once per attempted insertion. */
	weigh: (key: K, value: V) => number;
}

/** Immutable snapshot of current usage and configured cache limits. */
export interface CacheStats
{
	/** Number of retained entries. */
	readonly entries: number;
	/** Sum of retained entry weights; equals entry count for an unweighted cache. */
	readonly weight: number;
	/** Configured maximum entry count. */
	readonly maxEntries: number;
	/** Infinity for a cache limited only by entry count. */
	readonly maxWeight: number;
}

/**
 * Synchronous, bounded cache using Map key identity (SameValueZero).
 * Successful get/set refresh recency; has/peek/keys do not. Values are not copied.
 * Rejected or throwing insertions leave the cache unchanged. Callbacks must not
 * mutate this cache. No TTL, background work, or asynchronous loading is performed.
 */
export class LruCache<K, V>
{
	private readonly items = new Map<K, { value: V; weight: number }>();
	private retainedWeight = 0;
	private readonly maxEntries: number;
	private readonly maxWeight: number;
	private readonly weigh: (key: K, value: V) => number;

	/** Create an entry-limited cache or supply weight limits and a weighing callback. */
	constructor(options: number | WeightedCacheOptions<K, V> = 1024)
	{
		this.maxEntries = typeof options === 'number' ? options : options.maxEntries === undefined ? 1024 : options.maxEntries;
		assertNonNegativeSafeInteger(this.maxEntries, 'maxEntries');

		if (typeof options === 'number')
		{
			this.maxWeight = Infinity;
			this.weigh = () => 1;
		}
		else
		{
			assertNonNegativeSafeInteger(options.maxWeight, 'maxWeight');

			if (typeof options.weigh !== 'function')
			{
				throw new TypeError('weigh must be a function');
			}

			this.maxWeight = options.maxWeight;
			this.weigh = options.weigh;
		}
	}

	/** Number of currently retained entries. */
	get size(): number
	{
		return this.items.size;
	}

	/** Sum of currently retained entry weights. */
	get weight(): number
	{
		return this.retainedWeight;
	}

	/** Return a new frozen snapshot of usage and limits. */
	get stats(): CacheStats
	{
		return Object.freeze({
			entries: this.size,
			weight: this.weight,
			maxEntries: this.maxEntries,
			maxWeight: this.maxWeight
		});
	}

	/** Test membership without refreshing recency. */
	has(key: K): boolean
	{
		return this.items.has(key);
	}

	/** Read a value without refreshing recency; missing keys return undefined. */
	peek(key: K): V | undefined
	{
		return this.items.get(key)?.value;
	}

	/** Read a value and mark an existing entry most recently used. */
	get(key: K): V | undefined
	{
		const entry = this.items.get(key);

		if (entry === undefined)
		{
			return undefined;
		}

		this.items.delete(key);
		this.items.set(key, entry);

		return entry.value;
	}

	/** Chainable insertion. Use trySet when admission needs to be observed. */
	set(key: K, value: V): this
	{
		this.trySet(key, value);

		return this;
	}

	/** False means disabled or oversized. An existing value is preserved on rejection. */
	trySet(key: K, value: V): boolean
	{
		if (this.maxEntries === 0 || this.maxWeight === 0)
		{
			return false;
		}

		const weight = this.weigh(key, value);
		assertNonNegativeSafeInteger(weight, 'weight');

		if (weight > this.maxWeight)
		{
			return false;
		}

		this.delete(key);
		// Reuse one cursor: restarting at the oldest key rescans deleted Map slots.
		// Allocate it only when eviction is needed.
		let oldest: MapIterator<K> | undefined;

		// Subtraction avoids overflow when two individually safe weights are added.
		while (this.size && (this.size >= this.maxEntries || this.retainedWeight > this.maxWeight - weight))
		{
			oldest ??= this.items.keys();
			this.delete(oldest.next().value!);
		}

		this.items.set(key, { value, weight });
		this.retainedWeight += weight;

		return true;
	}

	/** Remove an entry and its weight; return whether it existed. */
	delete(key: K): boolean
	{
		const entry = this.items.get(key);

		if (entry === undefined)
		{
			return false;
		}

		this.items.delete(key);
		this.retainedWeight -= entry.weight;

		return true;
	}

	/** Remove all entries and reset retained weight to zero. */
	clear(): void
	{
		this.items.clear();
		this.retainedWeight = 0;
	}

	/** Live iterator, ordered least to most recently used. */
	keys(): MapIterator<K>
	{
		return this.items.keys();
	}
}

/** LRU bounded by both entry count and caller-defined weight units. */
export class WeightedLruCache<K, V> extends LruCache<K, V>
{
	/** Create a cache with caller-defined weight accounting and optional entry limits. */
	constructor(options: WeightedCacheOptions<K, V>)
	{
		super(options);
	}
}
