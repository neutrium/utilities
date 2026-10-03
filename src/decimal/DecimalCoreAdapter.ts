import { mergeDefined } from '../configuration/index.js';
import { Decimal, type DecimalConstructor, type DecimalConfig, type DecimalConfigInput } from '@neutrium/decimal/core';
import type { NumericAdapter } from '../numeric/adapters/NumericAdapter.js';
import { decimalContext } from './context.js';

/** Immutable Decimal core context, with tier-preserving configuration. */
export interface DecimalCoreAdapter extends NumericAdapter<Decimal>
{
	/** Frozen Decimal settings captured when the adapter is created. */
	readonly config: Readonly<DecimalConfig>;
	/** Create an independent context in this tier; never modifies this adapter. */
	withConfig(options: DecimalConfigInput): DecimalCoreAdapter;
}

/** Create an isolated core Decimal adapter from current tier defaults and overrides. */
export function createDecimalAdapter(options: DecimalConfigInput = {}): DecimalCoreAdapter
{
	return create(Decimal, options);
}

function create(Source: DecimalConstructor, options: DecimalConfigInput): DecimalCoreAdapter
{
	const { core, operand, result, Output, Work } = decimalContext(Source, options);

	return Object.freeze({
		...core,
		tier: 'core',
		config: Output.config,
		withConfig: (updates: DecimalConfigInput) => create(Decimal, mergeDefined(Output.config, updates)),
	});
}

/** Default isolated core Decimal adapter. */
export const DecimalAdapter = createDecimalAdapter();
