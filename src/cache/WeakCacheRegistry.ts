/**
 * Lazy values scoped to object identity. Keys are weakly held; no enumeration,
 * size, or deterministic garbage-collection timing is exposed.
 * Factories run synchronously. Thrown failures are not cached; undefined is.
 * Promise values are stored as-is (including rejected promises).
 */
export class WeakCacheRegistry<K extends object, V>
{
	private entries = new WeakMap<K, V>();
	private readonly creating = new WeakSet<K>();

	/** Create a registry with a synchronous factory invoked on cache misses. */
	constructor(private readonly create: (key: K) => V)
	{
		if (typeof create !== 'function')
		{
			throw new TypeError('create must be a function');
		}
	}

	/** Return the cached value or create it. Reject recursive creation for the same key. */
	get(key: K): V
	{
		if (key === null || (typeof key !== 'object' && typeof key !== 'function'))
		{
			throw new TypeError('WeakCacheRegistry keys must be objects');
		}

		const entries = this.entries;

		if (entries.has(key))
		{
			return entries.get(key)!;
		}

		if (this.creating.has(key))
		{
			throw new Error('Recursive cache creation for the same key');
		}

		this.creating.add(key);

		try
		{
			const value = this.create(key);
			// clear() during creation invalidates this generation too.
			entries.set(key, value);
			return value;
		}
		finally
		{
			this.creating.delete(key);
		}
	}

	/** Test whether a value is cached without invoking the factory. */
	has(key: K): boolean
	{
		return this.entries.has(key);
	}

	/** Read a cached value without invoking the factory; missing keys return undefined. */
	peek(key: K): V | undefined
	{
		return this.entries.get(key);
	}

	/** Invalidate one key; return whether it had a cached value. */
	delete(key: K): boolean
	{
		return this.entries.delete(key);
	}

	/** Existing returned values remain valid; subsequent get calls create new values. */
	clear(): void
	{
		this.entries = new WeakMap();
	}
}
