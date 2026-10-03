import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Decimal } from '@neutrium/decimal/scientific';
import { numberAdapter as n } from '@neutrium/utilities/number';
import { floatAdapter as f } from '@neutrium/utilities/float';
import { DecimalAdapter as d, createDecimalAdapter } from '@neutrium/utilities/decimal';

// Shared behavioral checks for all concrete backends and tiers.
for (const backend of ['number', 'float', 'decimal']) {
	const adapters = [];
	for (const tier of backend === 'decimal' ? ['core', 'arithmetic', 'scientific'] : ['scientific']) {
		const module = await import(backend === 'decimal' ? `@neutrium/utilities/decimal/${tier}` : `@neutrium/utilities/${backend}`);
		const adapter = module[backend === 'decimal' ? 'DecimalAdapter' : `${backend}Adapter`];
		adapters.push(adapter);
		test(`${backend}/${tier}: scalar and tier contracts`, () => {
			assert.equal(adapter.tier, tier);
			assert.equal(Object.isFrozen(adapter), true);
			assert.equal(Object.isFrozen(adapter.config), true);
			for (const value of [' +1.25e2 ', 125, 125n])
				assert.equal(adapter.toNumber(adapter.from(value)), 125);
			assert.equal(adapter.isValue(adapter.from(1)), true);
			assert.equal(adapter.isValue('1'), false);
			assert.equal(adapter.compare(adapter.from(1), adapter.from(2)), -1);
			assert.equal(adapter.compare(adapter.from(2), adapter.from(1)), 1);
			assert.equal(adapter.compare(adapter.from(0), adapter.from('-0')), 0);
			assert.ok(Number.isNaN(adapter.compare(adapter.from('NaN'), adapter.from(1))));
			assert.equal(adapter.isFinite(adapter.from('Infinity')), false);
			assert.equal(adapter.isNaN(adapter.from('NaN')), true);
			assert.equal(adapter.isInteger(adapter.from('1.5')), false);
			assert.equal(adapter.isInteger(adapter.from('2')), true);
			assert.equal(adapter.toString(adapter.from('-0')), '-0');
			assert.ok(Object.is(adapter.toNumber(adapter.from('-0')), -0));
			assert.equal('add' in adapter, tier !== 'core');
			assert.equal('sqrt' in adapter, tier === 'scientific');
			if (backend === 'decimal') {
				const value = adapter.from(1);
				assert.equal(typeof value.add, tier === 'core' ? 'undefined' : 'function');
				assert.equal(typeof value.sqrt, tier === 'scientific' ? 'function' : 'undefined');
			}
			for (const value of ['', ' ', '0x10', '1_000', '1px', '+-1', 'nan', true, null, undefined,
				{}, { toString() { throw Error('must not coerce'); } }, Object(1)])
				assert.throws(() => adapter.from(value), TypeError);
			assert.equal(adapter.toString(adapter.from(adapter.toString(adapter.from('12.5')))), '12.5');
		});
		if (tier === 'core') continue;
		test(`${backend}/${tier}: arithmetic does not mutate operands`, () => {
			const a = adapter.from(12), b = adapter.from(4), text = adapter.toString(a);
			for (const [op, expected] of [['add', 16], ['sub', 8], ['mul', 48], ['div', 3], ['rem', 0]])
				assert.equal(adapter.toNumber(adapter[op](a, b)), expected);
			assert.equal(adapter.toNumber(adapter.neg(a)), -12);
			assert.equal(adapter.toNumber(adapter.abs(adapter.neg(a))), 12);
			const negative = adapter.from(-1.25);
			assert.equal(adapter.toNumber(adapter.floor(negative)), -2);
			assert.equal(adapter.toNumber(adapter.ceil(negative)), -1);
			assert.equal(adapter.toNumber(adapter.trunc(negative)), -1);
			assert.equal(adapter.toString(a), text);
			assert.equal(adapter.toNumber(adapter.div(adapter.from(1), adapter.from(0))), Infinity);
			assert.ok(adapter.isNaN(adapter.div(adapter.from(0), adapter.from(0))));
		});
	}
	if (backend === 'decimal') test(`${backend}: tiers share compatibility identity`, () => {
		assert.equal(adapters[0].identity, adapters[1].identity);
		assert.equal(adapters[0].identity, adapters[2].identity);
	});
}

for (const adapter of [n, f, d]) {
	test(`${adapter.id}: scientific functions and special values`, () => {
		for (const [fn, input, expected] of [['sqrt',4,2], ['cbrt',-8,-2], ['exp',0,1], ['ln',1,0],
			['sin',0,0], ['cos',0,1], ['tan',0,0], ['asin',0,0], ['acos',1,0], ['atan',0,0],
			['sinh',0,0], ['cosh',0,1], ['tanh',0,0], ['asinh',0,0], ['acosh',1,0], ['atanh',0,0]])
			assert.equal(adapter.toNumber(adapter[fn](adapter.from(input))), expected, fn);
		assert.equal(adapter.toNumber(adapter.pow(adapter.from(2), '10')), 1024);
		assert.equal(adapter.toNumber(adapter.pow(adapter.from(4), '0.5')), 2);
		assert.equal(adapter.toNumber(adapter.log(adapter.from(8), adapter.from(2))), 3);
		assert.ok(Math.abs(adapter.toNumber(adapter.pi()) - Math.PI) < 1e-6);
		assert.ok(Math.abs(adapter.toNumber(adapter.atan2(adapter.from(1), adapter.from(1))) - Math.PI/4) < 1e-6);
		assert.ok(adapter.isNaN(adapter.sqrt(adapter.from(-1))));
		assert.equal(adapter.toNumber(adapter.ln(adapter.from(0))), -Infinity);
		assert.throws(() => adapter.pow(adapter.from(2), '2px'), TypeError);
	});
}

test('float32 normalizes inputs and each operation result; Number retains binary64', () => {
	assert.notEqual(n.identity, f.identity);
	assert.notEqual(n.identity, d.identity);
	assert.equal(f.from(16777217), 16777216);
	assert.equal(n.from(16777217), 16777217);
	assert.equal(f.add(16777216, 1), 16777216);
	assert.equal(n.add(16777216, 1), 16777217);
	assert.equal(f.add(0.1, 0.2), Math.fround(Math.fround(0.1) + Math.fround(0.2)));
	assert.equal(f.from('1e40'), Infinity);
	assert.ok(Object.is(f.from('-1e-50'), -0));
	assert.equal(f.from(2 ** -149), 2 ** -149);
	assert.equal(f.from(2 ** -150), 0);
	assert.equal(f.from(1 + 2 ** -24), 1); // tie to even
	assert.equal(f.from(1 + 3 * 2 ** -24), 1 + 2 ** -22);
	assert.equal(f.isValue(0.1), false);
	assert.equal(f.isValue(Math.fround(0.1)), true);
	assert.equal(n.isValue(0.1), true);
	for (const adapter of [n, f]) {
		assert.throws(() => adapter.add('1', 2), TypeError);
		assert.equal('withConfig' in adapter, false);
		assert.ok(Object.is(adapter.neg(0), -0));
	}
});

test('Decimal settings are immutable and receiver context controls every result', () => {
	const input = { precision: 3, rounding: 'down' };
	const low = createDecimalAdapter(input);
	input.precision = 30;
	const high = low.withConfig({ precision: 12 });
	assert.equal(low.config.precision, 3);
	assert.equal(high.config.precision, 12);
	assert.equal(low.identity, high.identity);
	assert.notEqual(low.config, high.config);
	assert.equal(low.toString(low.div(high.from(1), high.from(7))), '0.142');
	assert.equal(high.toString(high.div(low.from(1), low.from(7))), '0.142857142857');
	assert.equal(low.toString(low.mul(high.from('1.2345'), high.from('2'))), '2.46');
	assert.equal(low.toString(low.add(high.from('1.2345'), high.from('2'))), '3.23');
	const value = low.from('1.2345');
	assert.equal(Object.isFrozen(value), true);
	assert.throws(() => { value.constructor.config = { precision: 100 }; }, TypeError);
	const cloned = value.constructor.clone({ precision: 9 });
	assert.equal(cloned.config.precision, 9);
	cloned.config = { precision: 11 };
	assert.equal(cloned.config.precision, 11);
	assert.equal(low.config.precision, 3);
	assert.throws(() => { low.config.precision = 100; }, TypeError);
	assert.throws(() => low.withConfig({ precision: 0 }));
	assert.equal(low.config.precision, 3);
});

test('Decimal defaults are captured and remain independent of later package changes', () => {
	const original = Decimal.config;
	const stable = createDecimalAdapter({ precision: 7 });
	try {
		Decimal.config = { precision: 2 };
		assert.equal(stable.config.precision, 7);
		assert.equal(stable.toString(stable.div(stable.from(1), stable.from(7))), '0.1428571');
	} finally { Decimal.config = original; }
});

test('Decimal operands are preserved until output exponent limits are applied', () => {
	const bounded = d.withConfig({ maxE: 3, minE: -3 });
	assert.equal(bounded.toString(bounded.mul(d.from('1e10'), d.from('1e-10'))), '1');
	assert.equal(bounded.toString(bounded.add(d.from('1e10'), d.from('-1e10'))), '0');
	assert.equal(bounded.toString(bounded.div(d.from('1e10'), d.from('1e10'))), '1');
	assert.equal(bounded.toNumber(bounded.mul(d.from('1e3'), d.from('1e3'))), Infinity);
	assert.equal(bounded.toNumber(bounded.from('1e10')), Infinity); // explicit conversion boundary
	assert.equal(d.toString(d.add(d.from('0.1'), d.from('0.2'))), '0.3');
	assert.equal(d.toString(d.from('9007199254740993')), '9007199254740993');
});

test('rounding and remainder follow the documented backend policies', () => {
	assert.ok(Object.is(n.round(-0.5), -0));
	assert.equal(d.toNumber(d.round(d.from('-0.5'))), -1);
	const even = d.withConfig({ rounding: 'half-even', modulo: 'euclid' });
	assert.equal(even.toNumber(even.round(even.from('2.5'))), 2);
	assert.equal(n.rem(-7, 3), -1);
	assert.equal(even.toNumber(even.rem(even.from(-7), even.from(3))), 2);
});
