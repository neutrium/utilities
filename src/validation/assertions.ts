import { isNonNegativeSafeInteger, isPositiveSafeInteger, isUint32, isInRange, isPlainRecord } from './guards.js';

/** Assertions return void, narrow unknown inputs, and never coerce or mutate them. */
export function assertString(value: unknown, name = 'value'): asserts value is string
{
	if (typeof value !== 'string')
	{
		throw new TypeError(`${name} must be a string`);
	}
}

/** Require a boolean without coercion; otherwise throw TypeError. */
export function assertBoolean(value: unknown, name = 'value'): asserts value is boolean
{
	if (typeof value !== 'boolean')
	{
		throw new TypeError(`${name} must be a boolean`);
	}
}

/** Require a bigint without coercion; otherwise throw TypeError. */
export function assertBigInt(value: unknown, name = 'value'): asserts value is bigint
{
	if (typeof value !== 'bigint')
	{
		throw new TypeError(`${name} must be a bigint`);
	}
}

/** Numeric assertions consistently throw RangeError, including for non-number inputs. */
export function assertFiniteNumber(value: unknown, name = 'value'): asserts value is number
{
	if (!Number.isFinite(value))
	{
		throw new RangeError(`${name} must be a finite number`);
	}
}
/** Require an integer number without coercion; otherwise throw RangeError. */
export function assertInteger(value: unknown, name = 'value'): asserts value is number
{
	if (!Number.isInteger(value))
	{
		throw new RangeError(`${name} must be an integer`);
	}
}

/** Require an integer within the safe number range; otherwise throw RangeError. */
export function assertSafeInteger(value: unknown, name = 'value'): asserts value is number
{
	if (!Number.isSafeInteger(value))
	{
		throw new RangeError(`${name} must be a safe integer`);
	}
}

/** Require a nonnegative safe integer, accepting -0; otherwise throw RangeError. */
export function assertNonNegativeSafeInteger(value: unknown, name = 'value'): asserts value is number
{
	if (!isNonNegativeSafeInteger(value))
	{
		throw new RangeError(`${name} must be a nonnegative safe integer`);
	}
}
/** Require a safe integer greater than zero; otherwise throw RangeError. */
export function assertPositiveSafeInteger(value: unknown, name = 'value'): asserts value is number
{
	if (!isPositiveSafeInteger(value))
	{
		throw new RangeError(`${name} must be a positive safe integer`);
	}
}

/** Require an integer from 0 through 2^32 - 1, accepting -0; otherwise throw RangeError. */
export function assertUint32(value: unknown, name = 'value'): asserts value is number
{
	if (!isUint32(value))
	{
		throw new RangeError(`${name} must be a uint32`);
	}
}

/** Require a finite number within inclusive finite bounds; invalid bounds or values throw RangeError. */
export function assertInRange(value: unknown, minimum: number, maximum: number, name = 'value'): asserts value is number
{
	if (!isInRange(value, minimum, maximum))
	{
		throw new RangeError(`${name} must be within finite inclusive bounds [${minimum}, ${maximum}]`);
	}
}

/** Reject null and undefined with TypeError, preserving all other values. */
export function assertDefined<T>(value: T, name = 'value'): asserts value is NonNullable<T>
{
	if (value === null || value === undefined)
	{
		throw new TypeError(`${name} must not be null or undefined`);
	}
}

/** Require a plain record as defined by {@link isPlainRecord}; otherwise throw TypeError. */
export function assertPlainRecord(value: unknown, name = 'value'): asserts value is Record<PropertyKey, unknown>
{
	if (!isPlainRecord(value))
	{
		throw new TypeError(`${name} must be a plain record`);
	}
}

/** Require membership using SameValueZero equality; otherwise throw RangeError. */
export function assertOneOf<const Choices extends readonly unknown[]>(value: unknown, choices: Choices, name = 'value'): asserts value is Choices[number]
{
	if (!choices.includes(value))
	{
		throw new RangeError(`${name} must be one of the allowed values`);
	}
}

/**
 * Requires a plain record and rejects unknown own keys, including symbols and
 * non-enumerable keys. Does not require allowed keys to exist or validate values.
 * Numeric allowed keys use their string property names; symbols retain identity.
 * Accessors are not invoked; Proxy reflection traps may run and their errors propagate.
 */
export function assertKnownKeys(value: unknown, keys: readonly PropertyKey[], name = 'value'): asserts value is Record<PropertyKey, unknown>
{
	assertPlainRecord(value, name);
	const allowed = new Set(keys.map(key => typeof key === 'number' ? String(key) : key));

	for (const key of Reflect.ownKeys(value))
	{
		if (!allowed.has(key))
		{
			throw new TypeError(`Unknown ${name} option: ${String(key)}`);
		}
	}
}
