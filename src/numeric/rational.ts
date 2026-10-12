import { assertBigInt, assertKnownKeys, assertPositiveSafeInteger, assertString } from '../validation/assertions.js';
export { hasRationalArithmetic } from './adapters/RationalArithmeticAdapter.js';
export type { RationalArithmeticAdapter } from './adapters/RationalArithmeticAdapter.js';

/** Finite value represented as numerator / denominator multiplied by 10 ** exponent. */
export interface RationalTerm
{
	/** Signed integer numerator; zero has no separate sign. */
	readonly numerator: bigint;
	/** Positive integer denominator. */
	readonly denominator: bigint;
	/** Decimal exponent retained separately, without expansion. */
	readonly exponent: bigint;
}

/** Exact fraction or a function returning ordered lower/upper bounds at a working precision. */
export type RationalValue = {
	/** Exact finite value. */
	readonly exact: RationalTerm;
} | {
	/** Enclose the value using a positive safe-integer decimal precision. */
	bounds(precision: number): readonly [RationalTerm, RationalTerm];
};

function validateTerm(term: RationalTerm): void
{
	if (term === null || typeof term !== 'object')
	{
		throw new TypeError('Expected a rational term');
	}

	assertBigInt(term.numerator, 'numerator');
	assertBigInt(term.denominator, 'denominator');
	assertBigInt(term.exponent, 'exponent');

	if (term.denominator <= 0n)
	{
		throw new RangeError('Rational denominator must be positive');
	}
}

/**
 * Parse a finite decimal literal exactly, without a numeric backend or floating-point conversion.
 * Accepts signs, decimal points and scientific notation; whitespace, NaN, infinities,
 * hexadecimal and non-string inputs throw TypeError. Does not reduce trailing zeros.
 * Negative zero becomes numerator 0n. Input size remains subject to engine resource limits.
 */
export function parseRationalTerm(text: string): RationalTerm
{
	assertString(text, 'text');

	const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text);

	if (!match || match[0].length !== text.length || !(match[2] || match[3]))
	{
		throw new TypeError('Expected a finite decimal literal');
	}

	return {
		numerator: BigInt((match[1] === '-' ? '-' : '') + (match[2] || '0') + (match[3] || '')),
		denominator: 1n, exponent: BigInt(match[4] || 0) - BigInt((match[3] || '').length)
	};
}

/**
 * Multiply a valid rational term by an exact BigInt fraction without rounding or mutation.
 * Retains the exponent and normalizes the denominator's sign; does not reduce common factors.
 * A zero scaling denominator throws RangeError; non-BigInt components throw TypeError.
 */
export function scaleTerm(term: RationalTerm, numerator: bigint, denominator = 1n): RationalTerm
{
	validateTerm(term);
	assertBigInt(numerator, 'scaling numerator');
	assertBigInt(denominator, 'scaling denominator');

	if (!denominator)
	{
		throw new RangeError('Scaling denominator must be nonzero');
	}

	const sign = denominator < 0n ? -1n : 1n;

	return {
		numerator: term.numerator * numerator * sign,
		denominator: term.denominator * denominator * sign,
		exponent: term.exponent
	};
}

/** Negate an exact value or lazily negate and reverse its bounds; never mutate the source. */
export function negateValue(value: RationalValue): RationalValue
{
	if (value === null || typeof value !== 'object')
	{
		throw new TypeError('Expected a rational value');
	}

	if ('exact' in value)
	{
		return { exact: scaleTerm(value.exact, -1n) };
	}

	if (typeof value.bounds !== 'function')
	{
		throw new TypeError('Expected rational bounds');
	}

	return {
		bounds(precision) {
			const [lower, upper] = readBounds(value, precision);
			return [scaleTerm(upper, -1n), scaleTerm(lower, -1n)];
		},
	};
}

/** Controls for synchronous adaptive evaluation of rational enclosures. */
export interface RationalEvaluationOptions<T>
{
	/** First working precision, a positive safe integer; defaults to 64. */
	readonly initialPrecision?: number;
	/** Maximum working precision, at least initialPrecision; defaults to 1,000,000. */
	readonly maxPrecision?: number;
	/** Whether the endpoint results agree; defaults to Object.is, distinguishing signed zero. */
	readonly equal?: (lower: T, upper: T) => boolean;
}

function readBounds(value: Exclude<RationalValue, { exact: RationalTerm }>, precision: number): readonly [RationalTerm, RationalTerm]
{
	const pair = value.bounds(precision);

	if (!Array.isArray(pair) || pair.length !== 2)
	{
		throw new TypeError('Expected two rational bounds');
	}

	validateTerm(pair[0]); validateTerm(pair[1]);

	return pair;
}

/**
 * Evaluate a function monotone in the same direction in every operand; negate subtrahends first.
 * Exact inputs are evaluated once. Otherwise, double working precision until both enclosure
 * endpoints give equal results, evaluating the configured maximum before throwing RangeError.
 * Bounds providers must enclose their value in lower/upper order. The evaluator must be pure
 * and synchronous; custom equality must establish agreement at the required output accuracy.
 * Callbacks must not mutate terms. Callback errors propagate immediately; they are not retried.
 */
export function evaluateRational<T>(values: readonly RationalValue[], evaluate: (terms: RationalTerm[]) => T,
	options: RationalEvaluationOptions<T> = {}): T
{
	assertKnownKeys(options, ['initialPrecision', 'maxPrecision', 'equal'], 'rational evaluation');

	const { initialPrecision = 64, maxPrecision = 1000000, equal = Object.is } = options;

	assertPositiveSafeInteger(initialPrecision, 'initialPrecision');
	assertPositiveSafeInteger(maxPrecision, 'maxPrecision');

	if (initialPrecision > maxPrecision)
	{
		throw new RangeError('initialPrecision must not exceed maxPrecision');
	}

	if (typeof evaluate !== 'function' || typeof equal !== 'function')
	{
		throw new TypeError('Expected evaluation and equality functions');
	}

	if (!Array.isArray(values))
	{
		throw new TypeError('Expected an array of rational values');
	}

	for (const value of values)
	{
		if (value === null || typeof value !== 'object')
		{
			throw new TypeError('Expected a rational value');
		}

		if ('exact' in value)
		{
			validateTerm(value.exact);
		}
		else if (typeof value.bounds !== 'function')
		{
			throw new TypeError('Expected rational bounds');
		}
	}

	if (values.every(value => 'exact' in value))
	{
		return evaluate(values.map(value => value.exact));
	}

	for (let precision = initialPrecision;; precision = Math.min(precision * 2, maxPrecision))
	{
		const bounds = values.map(value => 'exact' in value ? [value.exact, value.exact] : readBounds(value, precision));
		const low = evaluate(bounds.map(pair => pair[0])), high = evaluate(bounds.map(pair => pair[1]));

		if (equal(low, high))
		{
			return low;
		}

		if (precision === maxPrecision)
		{
			throw new RangeError('Calculation exceeds precision limit');
		}
	}
}
