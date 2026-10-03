import { expectTypeOf, test } from 'vitest';
import { mergeDefined, resolveConfig, type ConfigurationValidator } from '@neutrium/utilities/configuration';
import { assertKnownKeys, assertPositiveSafeInteger, assertOneOf } from '@neutrium/utilities';

test('configuration public type contract', () => {
	interface Config { precision: number; mode: 'fast' | 'precise'; label?: string }
	const defaults: Config = { precision: 20, mode: 'fast', label: undefined };

	function validate(value: unknown): asserts value is Config
	{
		assertKnownKeys(value, ['precision', 'mode', 'label']);
		assertPositiveSafeInteger(value.precision);
		assertOneOf(value.mode, ['fast', 'precise']);

		if (value.label !== undefined && typeof value.label !== 'string')
		{
			throw new TypeError('label');
		}
	}

	const validator: ConfigurationValidator<Config> = validate;
	const merged: Config = mergeDefined(defaults, { precision: 30 });
	merged.precision = 40;
	const result: Readonly<Config> = resolveConfig(defaults, { mode: 'precise' } as unknown, validator);
	// @ts-expect-error result is readonly
	result.precision = 1;
	// @ts-expect-error update cannot introduce fields
	mergeDefined(defaults, { typo: 1 });
	// @ts-expect-error update cannot change types
	mergeDefined(defaults, { precision: '20' });
	void [merged, result];
	expectTypeOf(resolveConfig(defaults, {}, validator)).toEqualTypeOf<Readonly<Config>>();
});
