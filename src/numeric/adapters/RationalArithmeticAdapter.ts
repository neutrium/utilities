import type { ArithmeticAdapter } from './ArithmeticAdapter.js';
import type { RationalTerm } from '../rational.js';

/** Optional exact-rational capability in addition to the ordinary arithmetic contract. */
export interface RationalArithmeticAdapter<T> extends ArithmeticAdapter<T>
{
	/** Extract the represented finite value exactly, without rounding or serialization. */
	toRationalTerm(value: T): RationalTerm;
	/** Round the complete rational sum once using the backend's output precision and range. */
	fromRationalSum(terms: Iterable<RationalTerm>): T;
	/** Compare the unrounded sum with zero, independently of output precision and range. */
	compareRationalSum(terms: Iterable<RationalTerm>): -1 | 0 | 1;
}

/**
 * Check the three additional methods on an existing arithmetic adapter, including inherited methods.
 * Does not validate the base arithmetic contract or infer support from diagnostic backend names.
 * Imports no backend; Number and custom arithmetic adapters need not implement this capability.
 */
export function hasRationalArithmetic<T>(numeric: ArithmeticAdapter<T>): numeric is RationalArithmeticAdapter<T>
{
	if (numeric === null || (typeof numeric !== 'object' && typeof numeric !== 'function'))
	{
		return false;
	}

	const exact = numeric as Partial<RationalArithmeticAdapter<T>>;

	return typeof exact.toRationalTerm === 'function' && typeof exact.fromRationalSum === 'function'
		&& typeof exact.compareRationalSum === 'function';
}
