import { mergeDefined } from '../configuration/index.js';
import { Decimal, type DecimalConstructor, type DecimalConfig, type DecimalConfigInput } from '@neutrium/decimal/arithmetic';
import type { ArithmeticAdapter } from '../numeric/adapters/ArithmeticAdapter.js';
import { decimalContext } from './context.js';

/** Immutable Decimal arithmetic context, with tier-preserving configuration. */
export interface DecimalArithmeticAdapter extends ArithmeticAdapter<Decimal>
{
	/** Frozen Decimal settings captured when the adapter is created. */
	readonly config: Readonly<DecimalConfig>;
	/** Create an independent context in this tier; never modifies this adapter. */
	withConfig(options: DecimalConfigInput): DecimalArithmeticAdapter;
}

/** Create an isolated arithmetic Decimal adapter from current tier defaults and overrides. */
export function createDecimalAdapter(options: DecimalConfigInput = {}): DecimalArithmeticAdapter
{
	return create(Decimal, options);
}

function create(Source: DecimalConstructor, options: DecimalConfigInput): DecimalArithmeticAdapter
{
	const { core, operand, result, Output, Work } = decimalContext(Source, options);

	return Object.freeze({
		...core, tier: 'arithmetic', config: Output.config,
		withConfig: (updates: DecimalConfigInput) => create(Decimal, mergeDefined(Output.config, updates)),
		add: (a: Decimal, b: Decimal) => result(operand(a).add(operand(b))),
		sub: (a: Decimal, b: Decimal) => result(operand(a).sub(operand(b))),
		mul: (a: Decimal, b: Decimal) => result(operand(a).mul(operand(b))),
		div: (a: Decimal, b: Decimal) => result(operand(a).div(operand(b))),
		rem: (a: Decimal, b: Decimal) => result(operand(a).mod(operand(b))),
		neg: (value: Decimal) => result(operand(value).neg()),
		abs: (value: Decimal) => result(operand(value).abs()),
		floor: (value: Decimal) => result(operand(value).floor()),
		ceil: (value: Decimal) => result(operand(value).ceil()),
		trunc: (value: Decimal) => result(operand(value).trunc()),
		round: (value: Decimal) => result(operand(value).round()),
	});
}

/** Default isolated arithmetic Decimal adapter. */
export const DecimalAdapter = createDecimalAdapter();
