import assert from 'node:assert/strict';
import { test } from 'vitest';
import { runInNewContext } from 'node:vm';
import * as v from '@neutrium/utilities/validation';
import * as root from '@neutrium/utilities';

const cases = [
	['FiniteNumber', [0, -0, 0.5, -3, Number.MAX_VALUE], [NaN, Infinity, -Infinity]],
	['Integer', [0, -0, -1, Number.MAX_SAFE_INTEGER + 1], [0.5, NaN, Infinity]],
	['SafeInteger', [0, -1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER], [0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1]],
	['NonNegativeSafeInteger', [0, -0, 1, Number.MAX_SAFE_INTEGER], [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]],
	['PositiveSafeInteger', [1, Number.MAX_SAFE_INTEGER], [0, -0, -1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]],
	['Uint32', [0, -0, 1, 0xffffffff], [-1, 0.5, 0x100000000, NaN, Infinity]],
];
const nonNumbers = [undefined, null, false, true, '', '1', 1n, Symbol(), {}, [], new Number(1)];

for (const [suffix, valid, invalid] of cases) {
	test(`${suffix} validation enforces numeric boundaries without coercion`, () => {
		for (const value of valid) {
			if (v[`is${suffix}`]) assert.equal(v[`is${suffix}`](value), true);
			assert.equal(v[`assert${suffix}`](value), undefined);
		}
		for (const value of [...invalid, ...nonNumbers]) {
			if (v[`is${suffix}`]) assert.equal(v[`is${suffix}`](value), false);
			assert.throws(() => v[`assert${suffix}`](value, 'count'), { name: 'RangeError', message: /^count must be/ });
		}
	});
}

test('primitive assertions reject wrappers and assertions use TypeError', () => {
	for (const [suffix, valid, invalid] of [
		['String', ['', 'hello'], [new String('hello'), 1, null]],
		['Boolean', [true, false], [new Boolean(false), 0, 'false']],
		['BigInt', [0n, -1n, 2n ** 100n], [Object(1n), 1, '1']],
	]) {
		for (const value of valid) {
			if (v[`is${suffix}`]) assert.equal(v[`is${suffix}`](value), true);
			assert.equal(v[`assert${suffix}`](value), undefined);
		}
		for (const value of invalid) {
			if (v[`is${suffix}`]) assert.equal(v[`is${suffix}`](value), false);
			assert.throws(() => v[`assert${suffix}`](value, 'input'), { name: 'TypeError', message: /^input must be/ });
		}
	}
});

test('inclusive finite ranges accept fractions and reject invalid bounds', () => {
	for (const value of [-1, 0, 0.5, 1]) {
		assert.equal(v.isInRange(value, -1, 1), true);
		v.assertInRange(value, -1, 1);
	}
	assert.equal(v.isInRange(1, 1, 1), true);
	for (const [value, min, max] of [[2, -1, 1], ['0', -1, 1], [NaN, -1, 1], [0, 1, -1], [0, -Infinity, 1], [0, 0, Infinity], [0, NaN, 1], [0, '0', 1]]) {
		assert.equal(v.isInRange(value, min, max), false);
		assert.throws(() => v.assertInRange(value, min, max), RangeError);
	}
});

test('defined checks preserve falsy values', () => {
	for (const value of [false, 0, -0, '', NaN]) {
		v.assertDefined(value);
	}
	for (const value of [null, undefined]) {
		assert.throws(() => v.assertDefined(value), TypeError);
	}
});

test('plain records accept null prototypes and do not read accessors', () => {
	const accessor = { get value() { throw Error('must not read'); } };
	for (const value of [{}, Object.create(null), Object.freeze({ a: 1 }), accessor]) {
		assert.equal(v.isPlainRecord(value), true);
		v.assertPlainRecord(value);
	}
	const revoked = Proxy.revocable({}, {}); revoked.revoke();
	for (const value of [null, [], new Date(), new Map(), new (class Example {})(), Object.create({}), () => {}, runInNewContext('({})'), revoked.proxy]) {
		assert.equal(v.isPlainRecord(value), false);
		assert.throws(() => v.assertPlainRecord(value), TypeError);
	}
});

test('choice membership uses SameValueZero and object identity without stringifying inputs', () => {
	const object = { toString() { throw Error('must not stringify'); } };
	const choices = Object.freeze(['small', 0, NaN, object]);
	for (const value of ['small', -0, NaN, object]) {
		v.assertOneOf(value, choices);
	}
	for (const value of ['large', {}, '0']) {
		assert.throws(() => v.assertOneOf(value, choices, 'mode'), { name: 'RangeError', message: 'mode must be one of the allowed values' });
	}
	assert.throws(() => v.assertOneOf(undefined, []), RangeError);
	v.assertOneOf(undefined, [undefined]);
});

test('known keys checks nonenumerable and symbol keys without invoking getters', () => {
	const symbol = Symbol('option');
	const value = Object.create(null, { count: { get() { throw Error('must not read'); } } });
	value[symbol] = 1;
	v.assertKnownKeys(value, ['count', symbol]);
	assert.throws(() => v.assertKnownKeys(value, ['count']), /Unknown value option: Symbol\(option\)/);
	assert.throws(() => v.assertKnownKeys(value, [symbol]), /Unknown value option: count/);
	v.assertKnownKeys({}, ['optional']);
	assert.throws(() => v.assertKnownKeys([], []), TypeError);
	const proxy = new Proxy({}, { ownKeys() { throw Error('reflection failed'); } });
	assert.throws(() => v.assertKnownKeys(proxy, []), /reflection failed/);
});

test('known keys normalizes numeric property names while preserving symbol identity', () => {
	const symbol = Symbol('1');
	const numeric = [1, -0, -2, 1.5, 1e21, NaN, Infinity, -Infinity];
	const value = Object.fromEntries(numeric.map(key => [key, true]));
	value[symbol] = true;
	const allowed = Object.freeze([...numeric, symbol]);
	v.assertKnownKeys(value, allowed);
	v.assertKnownKeys({ 1: 'value' }, [1]);
	v.assertKnownKeys({ 1: 'value' }, ['1']);
	assert.throws(() => v.assertKnownKeys({ '01': true }, [1]), /Unknown value option: 01/);
	assert.throws(() => v.assertKnownKeys({ '-0': true }, [-0]), /Unknown value option: -0/);
	assert.throws(() => v.assertKnownKeys({ 2: true }, [1]), /Unknown value option: 2/);
	assert.throws(() => v.assertKnownKeys({ [symbol]: true }, [1, '1', Symbol('1')]), TypeError);
});

test('validation does not coerce inputs and root exports match the feature', () => {
 const value = { valueOf() { throw Error('coercion'); }, toString() { throw Error('coercion'); } };
 for (const [suffix] of cases) assert.throws(() => v[`assert${suffix}`](value), RangeError);
 for (const [name, exported] of Object.entries(v)) assert.equal(root[name], exported);
});
