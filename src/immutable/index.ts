/** Recursively readonly properties, preserving array and tuple shapes. */
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

/** Keys guaranteed to be present in a typed override record. @inline */
type RequiredKeys<T> = {
	[K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T];

/** Optional overrides may leave source values intact; preserve source union members. @inline */
type Overridden<T, O> = T extends unknown ? {
	[K in keyof T as K extends RequiredKeys<O> ? never : K]: K extends keyof O ? T[K] | O[K] : T[K];
} & Pick<O, RequiredKeys<O>> & Omit<O, keyof T> : never;

const snapshots = new WeakSet<object>();

/** Preserve reflection error identity instead of turning proxy failures into false guards. */
function assertRoot(value: unknown, name: string, allowArray = false): asserts value is object
{
	if (value !== null && typeof value === 'object')
	{
		const prototype = Object.getPrototypeOf(value);
		if (Array.isArray(value) ? allowArray && prototype === Array.prototype :
			prototype === Object.prototype || prototype === null)
		{
			return;
		}
	}

	throw new TypeError(`${name} must be a plain record${allowArray ? ' or array' : ''}`);
}

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
export function immutableSnapshot<T>(value: T): DeepReadonly<T>;
/**
 * Override own root properties before copying and freezing a data graph.
 * Existing properties retain their enumerability; new properties use the override's
 * enumerability. Overrides are copied into the same graph, so references to the input
 * root resolve to the snapshot root. Nested properties are not merged or defaulted.
 * Overrides must be plain records. Roots may also be arrays, but array length and
 * index overrides are rejected. Accessors are rejected even when overridden.
 * Replaced values are not traversed; proxy reflection errors propagate unchanged.
 *
 * @example Bind configuration without breaking self-references
 * ```ts
 * const source: { locale?: string; self?: unknown } = {};
 * source.self = source;
 * const snapshot = immutableSnapshot(source, { locale: 'en-US' });
 * snapshot.self === snapshot; // true
 * snapshot.locale; // 'en-US'
 * ```
 */
export function immutableSnapshot<T extends object, Overrides extends object>(
	value: T, rootOverrides: Overrides,
): DeepReadonly<Overridden<T, Overrides>>;
export function immutableSnapshot(value: unknown, rootOverrides?: object): unknown
{
	let overrides: Map<PropertyKey, PropertyDescriptor> | undefined;

	if (rootOverrides !== undefined)
	{
		assertRoot(value, 'Snapshot root', true);
		assertRoot(rootOverrides, 'Root overrides');
		overrides = new Map();

		for (const key of Reflect.ownKeys(rootOverrides))
		{
			if (Array.isArray(value) && (key === 'length' || typeof key === 'string' &&
				/^(?:0|[1-9]\d*)$/.test(key) && Number(key) < 0xffffffff))
			{
				throw new TypeError('Snapshot overrides cannot change array length or indices');
			}

			const descriptor = Object.getOwnPropertyDescriptor(rootOverrides, key);

			if (!descriptor || !('value' in descriptor))
			{
				throw new TypeError('Snapshot overrides cannot contain accessors');
			}

			overrides.set(key, descriptor);
		}
	}

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
		const remaining = source === value ? overrides : undefined;

		for (const key of Reflect.ownKeys(source))
		{
			const descriptor = Object.getOwnPropertyDescriptor(source, key);

			if (!descriptor || !('value' in descriptor))
			{
				throw new TypeError('Snapshots cannot contain accessors');
			}

			Object.defineProperty(target, key, {
				value: copy(remaining?.has(key) ? remaining.get(key)!.value : descriptor.value),
				enumerable: descriptor.enumerable,
				writable: false, configurable: false,
			});
			remaining?.delete(key);
		}

		for (const [key, descriptor] of remaining ?? [])
		{
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

	return result;
}
