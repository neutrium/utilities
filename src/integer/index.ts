import { assertBigInt } from '../validation/assertions.js';

function magnitude(value: bigint): bigint { return value < 0n ? -value : value; }

/** Greatest common divisor. */
function gcd(a: bigint, b: bigint): bigint
{
	while (b !== 0n)
	{
		[a, b] = [b, a % b];
	}

	return a;
}

/** Nonnegative greatest common divisor. gcdBigInt(0n, 0n) is 0n. */
export function gcdBigInt(a: bigint, b: bigint): bigint
{
	assertBigInt(a, 'a');
	assertBigInt(b, 'b');

	return gcd(magnitude(a), magnitude(b));
}

/** Nonnegative least common multiple. Zero if either input is zero. */
export function lcmBigInt(a: bigint, b: bigint): bigint
{
	assertBigInt(a, 'a');
	assertBigInt(b, 'b');
	a = magnitude(a);
	b = magnitude(b);

	return a === 0n || b === 0n ? 0n : (a / gcd(a, b)) * b;
}

function validateDivision(dividend: bigint, divisor: bigint): void
{
	assertBigInt(dividend, 'dividend');
	assertBigInt(divisor, 'divisor');

	if (divisor === 0n)
	{
		throw new RangeError('divisor must be nonzero');
	}
}

/** Exact integer quotient rounded toward negative infinity, unlike native truncation. */
export function divFloorBigInt(dividend: bigint, divisor: bigint): bigint
{
	validateDivision(dividend, divisor);
	const quotient = dividend / divisor;

	return dividend % divisor !== 0n && (dividend < 0n) !== (divisor < 0n) ? quotient - 1n : quotient;
}

/** Exact integer quotient rounded toward positive infinity. */
export function divCeilBigInt(dividend: bigint, divisor: bigint): bigint
{
	validateDivision(dividend, divisor);
	const quotient = dividend / divisor;

	return dividend % divisor !== 0n && (dividend < 0n) === (divisor < 0n) ? quotient + 1n : quotient;
}

/** Euclidean modulo: result is in [0, abs(divisor)), regardless of either input's sign. */
export function moduloBigInt(dividend: bigint, divisor: bigint): bigint
{
	validateDivision(dividend, divisor);
	const remainder = dividend % divisor;

	return remainder < 0n ? remainder + magnitude(divisor) : remainder;
}

export * from './words.js';
