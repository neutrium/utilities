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

test('root overrides bind frozen data without breaking cycles, aliases or nested values', () => {
	const child = { locale: undefined };
	const source = Object.assign(Object.create(null), { child, locale: undefined });
	source.self = source;
	child.parent = source;
	Object.freeze(source);
	const added = { parent: source, alias: child };
	const copy = immutableSnapshot(source, Object.freeze({ locale: 'en-US', added, alias: child }));
	expect(copy.locale).toBe('en-US');
	expect(copy.self).toBe(copy);
	expect(copy.child.parent).toBe(copy);
	expect(copy.added.parent).toBe(copy);
	expect(copy.added.alias).toBe(copy.child);
	expect(copy.alias).toBe(copy.child);
	expect(copy.child.locale).toBeUndefined();
	expect(Object.getPrototypeOf(copy)).toBeNull();
	expect(source.locale).toBeUndefined();
	expect(Object.hasOwn(source, 'added')).toBe(false);
	expect(isImmutableSnapshot(copy)).toBe(true);
	expect(isImmutableSnapshot(copy.added)).toBe(true);
	expect(Object.isFrozen(added)).toBe(false);
});

test('overrides preserve existing enumerability and copy new hidden, symbol and special keys', () => {
	const symbol = Symbol('alias');
	const source = Object.defineProperty({ toString: 1 }, 'locale', { value: undefined });
	const overrides = Object.assign(Object.create(null), { locale: 'fr-FR', toString: 2 });
	Object.defineProperty(overrides, symbol, { value: source, enumerable: false });
	Object.defineProperty(overrides, '__proto__', { value: source, enumerable: true });
	const copy = immutableSnapshot(source, overrides);
	expect(Object.getOwnPropertyDescriptor(copy, 'locale')).toEqual({ value: 'fr-FR', enumerable: false, configurable: false, writable: false });
	expect(Object.getOwnPropertyDescriptor(copy, symbol).enumerable).toBe(false);
	expect(copy[symbol]).toBe(copy);
	expect(copy.__proto__).toBe(copy);
	expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
	expect(copy.toString).toBe(2);
});

test('override values replace rather than merge and may explicitly be undefined', () => {
	const source = { nested: { old: true }, locale: 'en-US', ignored: new Date() };
	const copy = immutableSnapshot(source, { nested: { next: true }, locale: undefined, ignored: null });
	expect(copy).toEqual({ nested: { next: true }, locale: undefined, ignored: null });
	expect(Object.hasOwn(copy, 'locale')).toBe(true);
	expect(source.locale).toBe('en-US');
	expect(Object.isFrozen(copy.nested)).toBe(true);
});

test('overrides reject accessors without invoking even replaced root accessors', () => {
	let reads = 0;
	const accessor = Object.defineProperty({}, 'locale', { get() { reads++; return 'en-US'; } });
	expect(() => immutableSnapshot(accessor, { locale: 'fr-FR' })).toThrow(TypeError);
	expect(() => immutableSnapshot({}, accessor)).toThrow(TypeError);
	expect(reads).toBe(0);
	expect(() => immutableSnapshot({}, { child: accessor })).toThrow(TypeError);
	expect(reads).toBe(0);
});

test('overrides require data roots and plain-record replacements', () => {
	class Custom {}
	for (const value of [null, false, 1, 'text', new Date(), new Custom(), () => {}]) {
		expect(() => immutableSnapshot(value, {})).toThrow(TypeError);
		expect(() => immutableSnapshot({}, value)).toThrow(TypeError);
	}
	for (const value of [new Map(), new Set(), new Date(), () => {}])
		expect(() => immutableSnapshot({}, { value })).toThrow(TypeError);
	const error = new Error('override reflection');
	expect(() => immutableSnapshot({}, new Proxy({}, { ownKeys() { throw error; } }))).toThrow(error);
	expect(() => immutableSnapshot({}, [])).toThrow(TypeError);
	const proxy = new Proxy({}, { getPrototypeOf() { throw error; } });
	expect(() => immutableSnapshot(proxy, {})).toThrow(error);
	expect(() => immutableSnapshot({}, proxy)).toThrow(error);
});

test('array roots support named overrides without changing sparse elements or length', () => {
	const source = new Array(3);
	source[1] = source;
	Object.freeze(source);
	const copy = immutableSnapshot(source, { locale: 'en-US', self: source });
	expect(Array.isArray(copy)).toBe(true);
	expect(copy.length).toBe(3);
	expect(0 in copy).toBe(false);
	expect(copy[1]).toBe(copy);
	expect(copy.self).toBe(copy);
	expect(copy.locale).toBe('en-US');
	for (const key of ['length', '0', '1', '3', '4294967294'])
		expect(() => immutableSnapshot(source, { [key]: 1 })).toThrow(TypeError);
});

test('root overrides retain iterative traversal for deep replacement graphs', () => {
	const source = {}, replacement = {};
	let cursor = replacement;
	for (let i = 0; i < 15000; i++) cursor = cursor.next = {};
	cursor.root = source;
	const result = immutableSnapshot(source, { replacement });
	let copy = result.replacement;
	for (let i = 0; i < 15000; i++) copy = copy.next;
	expect(copy.root).toBe(result);
	expect(isImmutableSnapshot(copy)).toBe(true);
});
