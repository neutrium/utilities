/** Accepts both +0 and -0. */
export function isNonNegativeSafeInteger(value: unknown): value is number
{
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Test for a safe integer greater than zero without coercion. */
export function isPositiveSafeInteger(value: unknown): value is number
{
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** Inclusive range 0 through 2^32 - 1; accepts -0. */
export function isUint32(value: unknown): value is number
{
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}

/** Inclusive finite range. Invalid, nonfinite or reversed bounds return false. */
export function isInRange(value: unknown, minimum: number, maximum: number): value is number
{
	return Number.isFinite(minimum) && Number.isFinite(maximum) && minimum <= maximum &&
		typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

/**
 * Accepts local Object.prototype or null prototypes, without reading properties.
 * Arrays, instances and foreign-realm Object prototypes are excluded. A proxy's
 * getPrototypeOf trap can run; a throwing trap returns false.
 */
export function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown>
{
	if (value === null || typeof value !== 'object')
	{
		return false;
	}

	try
	{
		const prototype = Object.getPrototypeOf(value);
		return !Array.isArray(value) && (prototype === Object.prototype || prototype === null);
	}
	catch
	{
		return false;
	}
}

