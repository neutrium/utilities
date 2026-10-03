import { assertPlainRecord } from '../validation/assertions.js';

/** Validate the complete merged configuration, including defaults and cross-field rules. */
export type ConfigurationValidator<T extends object> = (value: unknown) => asserts value is T;

function capture(value: unknown, name: string): Record<PropertyKey, unknown>
{
	assertPlainRecord(value, name);
	const output = Object.create(null) as Record<PropertyKey, unknown>;

	for (const key of Reflect.ownKeys(value))
	{
		const descriptor = Object.getOwnPropertyDescriptor(value, key);

		if (!descriptor || !('value' in descriptor))
		{
			throw new TypeError(`${name} must contain only data properties: ${String(key)}`);
		}

		output[key] = descriptor.value;
	}

	return output;
}

function merge(base: unknown, updates: readonly unknown[], name: string): Record<PropertyKey, unknown>
{
	const result = capture(base, `${name} defaults`);

	for (const update of updates)
	{
		const fields = capture(update, name);

		for (const key of Reflect.ownKeys(fields))
		{
			if (!Object.hasOwn(result, key))
			{
				throw new TypeError(`Unknown ${name} option: ${String(key)}`);
			}

			if (fields[key] !== undefined)
			{
				result[key] = fields[key];
			}
		}
	}

	// Spread creates data properties safely, including a literal __proto__ key.
	return { ...result };
}

/**
 * Shallow merge of known own data properties; undefined updates inherit prior values.
 * Later updates win. Null, false, zero and empty strings are explicit replacements.
 * Defaults must declare every allowed key, even optional keys with undefined values.
 * Rejects unknown keys and accessors. Returns a new mutable object without mutation
 * or deep copying. No value validation is performed by this typed-input helper.
 */
export function mergeDefined<T extends object>(defaults: T, ...updates: Partial<NoInfer<T>>[]): T
{
	return merge(defaults, updates, 'configuration') as T;
}

/**
 * Resolve untrusted input using defaults, then validate a shallow-frozen snapshot.
 * Undefined input means no update. The assertion must validate every field and
 * throw on failure; thrown errors propagate. Always returns a fresh object.
 * Nested references are shared; the validator must not mutate nested values.
 */
export function resolveConfig<T extends object>(
	defaults: T,
	input: unknown,
	validate: ConfigurationValidator<NoInfer<T>>,
	name = 'configuration',
): Readonly<T>
{
	if (typeof validate !== 'function')
	{
		throw new TypeError('validate must be a function');
	}

	const result = Object.freeze(merge(defaults, input === undefined ? [] : [input], name));
	validate(result);

	return result;
}
