import { expectTypeOf, test } from 'vitest';
import type { NumericAdapter, ArithmeticAdapter, ScientificAdapter } from '@neutrium/utilities';
import { numberAdapter as number } from '@neutrium/utilities/number';
import { floatAdapter as float } from '@neutrium/utilities/float';
import { createDecimalAdapter as decimalCore } from '@neutrium/utilities/decimal/core';
import { createDecimalAdapter as decimalArithmetic } from '@neutrium/utilities/decimal/arithmetic';
import { createDecimalAdapter } from '@neutrium/utilities/decimal';
import type { Decimal } from '@neutrium/decimal/scientific';

test('numeric public type contract', () => {
	function sum<T>(numeric: ArithmeticAdapter<T>, a: T, b: T): T { return numeric.add(a, b); }
	const result: number = sum(number, 1, 2);
	const decimal = createDecimalAdapter({ precision: 30 });
	const exact: Decimal = sum(decimal, decimal.from('0.1'), decimal.from('0.2'));
	const scalarCore: NumericAdapter<number> = number;
	const scalarArithmetic: ArithmeticAdapter<number> = float;
	const nativePower: number = number.pow(2, 3);
	const scalarScientific: ScientificAdapter<number> = float;
	const newContext = decimal.withConfig({ precision: 40 });
	newContext.sqrt(exact);
	const dc = decimalCore().withConfig({ precision: 12 });
	const da = decimalArithmetic().withConfig({ precision: 12 });
	// @ts-expect-error Decimal core has no arithmetic
	 dc.add(dc.from(1), dc.from(2));
	// @ts-expect-error Decimal arithmetic has no scientific operations
	 da.pow(da.from(2), 2);
	// @ts-expect-error Decimal core scalar must also stay in its tier
	 dc.from(1).add(2);
	// @ts-expect-error native formats are not configurable
	number.withConfig({ precision: 10 });
	// @ts-expect-error Decimal configuration is typed
	createDecimalAdapter({ rounding: 'not-a-rounding-mode' });
	// @ts-expect-error backend scalar types cannot be mixed implicitly
	decimal.add(1, 2);
	// @ts-expect-error immutable config
	newContext.config.precision = 10;
	// @ts-expect-error a numeric core cannot satisfy an arithmetic algorithm
	sum(dc, dc.from(1), dc.from(2));
	void [result, exact, scalarCore, scalarArithmetic, scalarScientific, nativePower];
	expectTypeOf(number.add(1, 2)).toEqualTypeOf<number>();
	expectTypeOf(sum(decimal, exact, exact)).toEqualTypeOf<Decimal>();
});
