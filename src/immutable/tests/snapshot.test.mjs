import { expect, test } from 'vitest';
import { immutableSnapshot, isImmutableSnapshot } from '@neutrium/utilities/immutable';
import { immutableSnapshot as rootSnapshot } from '@neutrium/utilities';

test('copies and freezes a graph while preserving cycles and shared references', () => {
	const child = { value: 1 }, source = { child, alias: child, list: [child] };
	source.self = source;
	const copy = immutableSnapshot(source);
	expect(rootSnapshot).toBe(immutableSnapshot);
	expect(copy).not.toBe(source);
	expect(copy.child).not.toBe(child);
	expect(copy.child).toBe(copy.alias);
	expect(copy.list[0]).toBe(copy.child);
	expect(copy.self).toBe(copy);

	for (const item of [copy, copy.child, copy.list])
	{
		expect(Object.isFrozen(item)).toBe(true);
		expect(isImmutableSnapshot(item)).toBe(true);
	}
	child.value = 2;
	expect(copy.child.value).toBe(1);
	expect(() => { copy.child.value = 3; }).toThrow(TypeError);
	expect(isImmutableSnapshot(source)).toBe(false);
	expect(isImmutableSnapshot(Object.freeze({}))).toBe(false);
	expect(immutableSnapshot(copy)).not.toBe(copy);
});

test('preserves holes, symbols, null prototypes, enumerability and special keys', () => {
	const symbol = Symbol('hidden');
	const source = Object.create(null);
	source.__proto__ = { value: 1 };
	Object.defineProperty(source, symbol, { value: { n: 2 }, enumerable: false });
	source.array = new Array(5);
	source.array[2] = undefined;
	source.array.extra = source;
	const copy = immutableSnapshot(source);
	expect(Object.getPrototypeOf(copy)).toBeNull();
	expect(Object.hasOwn(copy, '__proto__')).toBe(true);
	expect(copy.__proto__).not.toBe(source.__proto__);
	expect(Object.getOwnPropertyDescriptor(copy, symbol)).toEqual({ value: { n: 2 }, enumerable: false, writable: false, configurable: false });
	expect(copy.array.length).toBe(5);
	expect(Object.hasOwn(copy.array, 0)).toBe(false);
	expect(Object.hasOwn(copy.array, 2)).toBe(true);
	expect(copy.array.extra).toBe(copy);
	expect(isImmutableSnapshot(copy[symbol])).toBe(true);
});

test('passes through primitives including signed zero and does not brand them', () => {
	for (const value of [null, undefined, true, '', 1n, Symbol(), NaN, -0, Infinity])
	{
		expect(Object.is(immutableSnapshot(value), value)).toBe(true);
		expect(isImmutableSnapshot(value)).toBe(false);
	}
});

test('rejects accessors without reading them and leaves inputs untouched on failure', () => {
	let reads = 0;
	const child = { mutable: true };
	const source = { child, get danger() { reads++; return {}; } };
	expect(() => immutableSnapshot(source)).toThrow(TypeError);
	expect(reads).toBe(0);
	expect(Object.isFrozen(source)).toBe(false);
	expect(Object.isFrozen(child)).toBe(false);
	expect(isImmutableSnapshot(child)).toBe(false);
	const setter = Object.defineProperty({}, 'x', { set(_) { reads++; } });
	expect(() => immutableSnapshot(setter)).toThrow(TypeError);
	expect(reads).toBe(0);
});

test('rejects non-data prototypes and functions and propagates proxy reflection failures', () => {
	class Custom {}
	class CustomArray extends Array {}
	for (const value of [() => {}, new Date(), new Map(), new Set(), new Uint8Array(), new Custom(), new CustomArray(), Promise.resolve(1)])
	{
		expect(() => immutableSnapshot({ nested: value })).toThrow(TypeError);
	}
	const error = new Error('reflection');
	expect(() => immutableSnapshot(new Proxy({}, { ownKeys() { throw error; } }))).toThrow(error);
});

test('handles deeply nested data without consuming the call stack', () => {
	const source = {};
	let cursor = source;
	for (let i = 0; i < 15000; i++) cursor = cursor.next = {};
	let copy = immutableSnapshot(source);
	for (let i = 0; i < 15000; i++)
	{
		if (!Object.isFrozen(copy)) throw new Error('unfrozen node');
		copy = copy.next;
	}
	expect(Object.isFrozen(copy)).toBe(true);
});
