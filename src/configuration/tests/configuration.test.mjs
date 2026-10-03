import assert from 'node:assert/strict';
import { test } from 'vitest';
import { mergeDefined, resolveConfig } from '@neutrium/utilities/configuration';
import { assertPlainRecord, assertPositiveSafeInteger, cacheConfig } from '@neutrium/utilities';
import * as root from '@neutrium/utilities';

function validate(value) {
	assertPlainRecord(value);
	assertPositiveSafeInteger(value.minimum);
	assertPositiveSafeInteger(value.maximum);

	if (value.minimum > value.maximum)
	{
		throw new RangeError('minimum exceeds maximum');
	}
}

test('merge skips undefined, preserves explicit falsy values and applies layers in order', () => {
	const defaults = Object.freeze({ count: 2, enabled: true, label: 'default', optional: undefined, nullable: 'text' });
	const input = Object.freeze({ count: undefined, enabled: false, label: '', nullable: null });
	const result = mergeDefined(defaults, input, { count: 0, optional: 'value' });
	assert.deepEqual(result, { count: 0, enabled: false, label: '', optional: 'value', nullable: null });
	assert.equal(defaults.count, 2);
	assert.notEqual(result, defaults);
	assert.equal(Object.isFrozen(result), false);
	assert.deepEqual(mergeDefined(defaults), defaults);
});

test('own symbol and nonenumerable data keys are merged; prototype-sensitive names are safe', () => {
	const key = Symbol('option');
	const defaults = Object.create(null);
	Object.defineProperty(defaults, 'hidden', { value: 1 });
	defaults[key] = 2;
	defaults.__proto__ = 'default';
	const result = mergeDefined(defaults, { [key]: 3, ['__proto__']: 'updated' });
	assert.equal(result.hidden, 1);
	assert.equal(result[key], 3);
	assert.equal(result.__proto__, 'updated');
	assert.equal(Object.getPrototypeOf(result), Object.prototype);
	assert.throws(() => mergeDefined({}, JSON.parse('{"__proto__":{}}')), /Unknown/);
});

test('unknown keys are rejected even if undefined or nonenumerable', () => {
	for (const update of [{ typo: undefined }, { [Symbol()]: 1 }, Object.defineProperty({}, 'hidden', { value: 1 })])
	{
		assert.throws(() => mergeDefined({ count: 1 }, update), TypeError);
	}
});

test('inputs must be plain records and accessors are rejected without invocation', () => {
	const accessor = { get count() { throw Error('must not execute'); } };
	for (const input of [null, [], 1, new Date(), new (class Config {})(), accessor])
	{
		assert.throws(() => mergeDefined({ count: 1 }, input), TypeError);
		assert.throws(() => mergeDefined(input), TypeError);
	}
	assert.throws(() => mergeDefined({ count: 1 }, undefined), TypeError);
	const proxy = new Proxy({}, { ownKeys() { throw Error('reflection'); } });
	assert.throws(() => mergeDefined(proxy), /reflection/);
});

test('resolution validates the full frozen result and leaves inputs untouched', () => {
	const defaults = { minimum: 1, maximum: 10 };
	const input = { minimum: 3 };
	let calls = 0;
	const result = resolveConfig(defaults, input, value => {
		calls++;
		assert.equal(Object.isFrozen(value), true);
		validate(value);
	});
	assert.deepEqual(result, { minimum: 3, maximum: 10 });
	assert.equal(calls, 1);
	assert.throws(() => { result.minimum = 2; }, TypeError);
	defaults.minimum = 5; input.minimum = 6;
	assert.equal(result.minimum, 3);
	assert.notEqual(resolveConfig(result, undefined, validate), result);
});

test('resolution validates defaults too, propagates failures, and rejects input before validation', () => {
	assert.throws(() => resolveConfig({ minimum: 0, maximum: 10 }, undefined, validate), RangeError);
	assert.throws(() => resolveConfig({ minimum: 1, maximum: 10 }, { minimum: 11 }, validate), /minimum exceeds/);
	let calls = 0;
	assert.throws(() => resolveConfig({ a: 1 }, { b: 2 }, () => { calls++; }, 'parser'), /Unknown parser option: b/);
	assert.equal(calls, 0);
	const error = new Error('validation');
	assert.throws(() => resolveConfig({}, undefined, () => { throw error; }), value => value === error);
	assert.throws(() => resolveConfig({}, null, () => {}), TypeError);
	assert.throws(() => resolveConfig({}, undefined, null), TypeError);
});

test('merges are shallow: nested values are replaced and remain shared', () => {
	const nested = { limit: 2 };
	const result = resolveConfig({ nested: { other: 1 } }, { nested }, () => {});
	assert.equal(result.nested, nested);
	assert.equal(Object.isFrozen(nested), false);
	assert.deepEqual(result.nested, { limit: 2 });
});

test('cache configuration uses shared resolution and entry points share exports', () => {
	assert.equal(root.mergeDefined, mergeDefined);
	assert.equal(root.resolveConfig, resolveConfig);
	assert.deepEqual(cacheConfig({ maxBytes: undefined }, { maxEntries: 1, maxBytes: 4 }), { maxEntries: 1, maxBytes: 4 });
	assert.throws(() => cacheConfig({ get maxBytes() { throw Error('must not execute'); } }), TypeError);
	assert.throws(() => cacheConfig({ maxEntries: null }), RangeError);
});
