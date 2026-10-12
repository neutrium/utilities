import { assertNonNegativeSafeInteger } from '../validation/assertions.js';

/**
 * Two generations of weak object keys, with promotion on reads from the older generation.
 * Each generation admits at most generationSize new entries before rotation. Updates to
 * current entries do not consume capacity; deletion and GC do not reclaim admission slots.
 * This is an insertion bound, not a live size or heap-memory guarantee. Values are not copied.
 */
export class GenerationalWeakCache<K extends object, V>
{
	private current?: WeakMap<K, V>;
	private previous?: WeakMap<K, V>;
	private admissions = 0;

	/** Maximum new entries per generation, default 1024. Zero disables retention. */
	constructor(private readonly generationSize = 1024)
	{
		assertNonNegativeSafeInteger(generationSize, 'generationSize');
	}

	/** Read and promote an older entry. Undefined payloads are supported; use has to distinguish misses. */
	get(key: K): V | undefined
	{
		const value = this.current?.get(key);

		if (value !== undefined || this.current?.has(key))
		{
			return value;
		}

		const older = this.previous?.get(key);
		if (older !== undefined || this.previous?.has(key))
		{
			this.set(key, older as V);
		}

		return older;
	}

	/** Read without promotion or changing generation lifetime. */
	peek(key: K): V | undefined
	{
		return this.current?.has(key) ? this.current.get(key) : this.previous?.get(key);
	}

	/** Test membership without promotion. */
	has(key: K): boolean
	{
		return this.current?.has(key) === true || this.previous?.has(key) === true;
	}

	/** Insert or replace a value and return this cache. */
	set(key: K, value: V): this
	{
		this.trySet(key, value);
		return this;
	}

	/** Insert, rotating if needed. Returns false only when retention is disabled. Invalid keys throw. */
	trySet(key: K, value: V): boolean
	{
		if (key === null || (typeof key !== 'object' && typeof key !== 'function'))
		{
			throw new TypeError('GenerationalWeakCache keys must be objects');
		}

		if (this.generationSize === 0)
		{
			return false;
		}

		if (this.current?.has(key))
		{
			this.current.set(key, value);
			return true;
		}

		if (this.admissions === this.generationSize)
		{
			this.previous = this.current;
			this.current = undefined;
			this.admissions = 0;
		}

		(this.current ??= new WeakMap()).set(key, value);
		this.previous?.delete(key);
		this.admissions++;

		return true;
	}

	/** Delete from both generations; admission slots remain consumed until rotation. */
	delete(key: K): boolean
	{
		const current = this.current?.delete(key) === true;
		const previous = this.previous?.delete(key) === true;

		return current || previous;
	}

	/** Release both generations and reset the admission counter. */
	clear(): void
	{
		this.current = this.previous = undefined;
		this.admissions = 0;
	}
}
