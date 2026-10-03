/** Recursively readonly properties, preserving array and tuple shapes. */
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

const snapshots = new WeakSet<object>();

/** True only for objects produced by a successfully completed immutableSnapshot call. */
export function isImmutableSnapshot(value: unknown): boolean
{
	return value !== null && typeof value === 'object' && snapshots.has(value);
}

/**
 * Copy and deeply freeze plain data without retaining caller-owned objects.
 * Supports primitives, local plain/null-prototype records and local arrays. Preserves
 * cycles, shared references, array holes, symbols and property enumerability. Rejects
 * functions, accessors and other prototypes with TypeError. Never invokes getters;
 * proxy reflection traps can run and their errors propagate. Each call makes a fresh
 * graph. Primitives pass through unchanged. Traversal does not use recursive calls.
 */
export function immutableSnapshot<T>(value: T): DeepReadonly<T>
{
	const seen = new WeakMap<object, object>();
	const pending: { source: object; target: object }[] = [];

	function copy(input: unknown): unknown
	{
		if (typeof input === 'function')
		{
			throw new TypeError('Snapshots cannot contain functions');
		}

		if (input === null || typeof input !== 'object')
		{
			return input;
		}

		const existing = seen.get(input);

		if (existing)
		{
			return existing;
		}
		const array = Array.isArray(input);
		const prototype = Object.getPrototypeOf(input);
		if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
		{
			throw new TypeError('Snapshots support only plain records and arrays');
		}

		const target: object = array ? [] : Object.create(prototype);
		seen.set(input, target);
		pending.push({ source: input, target });

		return target;
	}

	const result = copy(value);

	for (let i = 0; i < pending.length; i++)
	{
		const { source, target } = pending[i];

		for (const key of Reflect.ownKeys(source))
		{
			const descriptor = Object.getOwnPropertyDescriptor(source, key);

			if (!descriptor || !('value' in descriptor))
			{
				throw new TypeError('Snapshots cannot contain accessors');
			}

			Object.defineProperty(target, key, {
				value: copy(descriptor.value), enumerable: descriptor.enumerable,
				writable: false, configurable: false,
			});
		}
	}

	for (const { target } of pending)
	{
		Object.freeze(target);
	}

	for (const { target } of pending)
	{
		snapshots.add(target);
	}

	return result as DeepReadonly<T>;
}
