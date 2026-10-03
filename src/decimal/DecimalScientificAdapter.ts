import { mergeDefined } from '../configuration/index.js';
import { Decimal, type DecimalConstructor, type DecimalConfig, type DecimalConfigInput } from '@neutrium/decimal/scientific';
import type { ScientificAdapter } from '../numeric/adapters/ScientificAdapter.js';
import { decimalContext } from './context.js';
import { literal } from '../numeric/literal.js';

/** Immutable Decimal scientific context, with tier-preserving configuration. */
export interface DecimalScientificAdapter extends ScientificAdapter<Decimal>
{
	/** Frozen Decimal settings captured when the adapter is created. */
	readonly config: Readonly<DecimalConfig>;
	/** Create an independent context in this tier; never modifies this adapter. */
	withConfig(options: DecimalConfigInput): DecimalScientificAdapter;
}

/** Create an isolated scientific Decimal adapter from current tier defaults and overrides. */
export function createDecimalAdapter(options: DecimalConfigInput = {}): DecimalScientificAdapter
{
	return create(Decimal, options);
}

function create(Source: DecimalConstructor, options: DecimalConfigInput): DecimalScientificAdapter
{
	const { core, operand, result, Output, Work } = decimalContext(Source, options);

	return Object.freeze({
		...core, tier: 'scientific', config: Output.config,
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
		pow: (value: Decimal, exponent: string | number | bigint | Decimal) => result(operand(value).pow(core.isValue(exponent) ? exponent : literal(exponent))),
		sqrt: (value: Decimal) => result(operand(value).sqrt()),
		cbrt: (value: Decimal) => result(operand(value).cbrt()),
		exp: (value: Decimal) => result(operand(value).exp()),
		ln: (value: Decimal) => result(operand(value).ln()),
		sin: (value: Decimal) => result(operand(value).sin()),
		cos: (value: Decimal) => result(operand(value).cos()),
		tan: (value: Decimal) => result(operand(value).tan()),
		asin: (value: Decimal) => result(operand(value).asin()),
		acos: (value: Decimal) => result(operand(value).acos()),
		atan: (value: Decimal) => result(operand(value).atan()),
		sinh: (value: Decimal) => result(operand(value).sinh()),
		cosh: (value: Decimal) => result(operand(value).cosh()),
		tanh: (value: Decimal) => result(operand(value).tanh()),
		asinh: (value: Decimal) => result(operand(value).asinh()),
		acosh: (value: Decimal) => result(operand(value).acosh()),
		atanh: (value: Decimal) => result(operand(value).atanh()),
		log: (value: Decimal, base: Decimal) => result(operand(value).log(operand(base))),
		atan2: (y: Decimal, x: Decimal) => result(Work.atan2(operand(y), operand(x))),
		pi: () => result(Work.PI),
	});
}

/** Default isolated scientific Decimal adapter. */
export const DecimalAdapter = createDecimalAdapter();
