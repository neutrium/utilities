import { assertBigInt, assertSafeInteger, assertUint32 } from '../validation/assertions.js';

/** Rotate an unsigned 32-bit word left; signed safe-integer shifts are reduced modulo 32. */
export function rotateLeft32(value: number, shift: number): number
{
	assertUint32(value, 'value');
	assertSafeInteger(shift, 'shift');
	const count = shift & 31;

	return ((value << count) | (value >>> ((32 - count) & 31))) >>> 0;
}

/** Rotate an unsigned 32-bit word right; negative shifts rotate left. */
export function rotateRight32(value: number, shift: number): number
{
	assertUint32(value, 'value');
	assertSafeInteger(shift, 'shift');
	const count = shift & 31;

	return ((value >>> count) | (value << ((32 - count) & 31))) >>> 0;
}

/** Split a bigint in [0, 2^64 - 1] into [low, high] unsigned 32-bit words. No truncation. */
export function splitUint64(value: bigint): readonly [number, number]
{
	assertBigInt(value, 'value');

	if (value < 0n || value > 0xffffffffffffffffn)
	{
		throw new RangeError('value must be a uint64');
	}

	return [Number(value & 0xffffffffn), Number(value >> 32n)];
}

/** Join unsigned 32-bit words in low-word, high-word order. Rejects invalid words without coercion. */
export function joinUint64(low: number, high: number): bigint
{
	assertUint32(low, 'low');
	assertUint32(high, 'high');

	return (BigInt(high) << 32n) | BigInt(low);
}
