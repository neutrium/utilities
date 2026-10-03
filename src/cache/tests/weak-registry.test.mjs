import assert from 'node:assert/strict';
import { test } from 'vitest';
import { WeakCacheRegistry } from '@neutrium/utilities/cache';

test('values are lazily scoped to object identity, including function keys', () => {
	let calls = 0;
	const registry = new WeakCacheRegistry(key => ({ key, id: ++calls }));
	const a = {}, b = {}, constructor = () => {};
	assert.equal(registry.has(a), false);
	assert.equal(registry.peek(a), undefined);
	assert.equal(calls, 0);
	const value = registry.get(a);
	assert.equal(registry.get(a), value);
	assert.notEqual(registry.get(b), value);
	assert.equal(registry.get(constructor).key, constructor);
	assert.equal(calls, 3);
	assert.equal(registry.delete(a), true);
	assert.equal(registry.delete(a), false);
	assert.notEqual(registry.get(a), value);
	registry.clear();
	assert.equal(registry.has(a), false);
	assert.notEqual(registry.get(a), value);
	assert.equal(value.key, a);
});

test('undefined is cached and factory failures are retried', () => {
	let calls = 0;
	const registry = new WeakCacheRegistry(() => { if (++calls === 1) throw Error('failure'); });
	const key = {};
	assert.throws(() => registry.get(key), /failure/);
	assert.equal(registry.has(key), false);
	assert.equal(registry.get(key), undefined);
	assert.equal(registry.has(key), true);
	assert.equal(registry.get(key), undefined);
	assert.equal(calls, 2);
});

test('invalid keys never invoke the factory; recursive creation fails without poisoning the key', () => {
	let calls = 0;
	let recursive = true;
	const registry = new WeakCacheRegistry(key => { calls++; return recursive ? registry.get(key) : 42; });
	for (const value of [null, undefined, 1, 'a', Symbol()])
		assert.throws(() => registry.get(value), TypeError);
	assert.equal(calls, 0);
	const key = {};
	assert.throws(() => registry.get(key), /Recursive/);
	assert.equal(registry.has(key), false);
	recursive = false;
	assert.equal(registry.get(key), 42);
});

test('clear during factory execution invalidates the in-flight generation', () => {
	const registry = new WeakCacheRegistry(() => { registry.clear(); return {}; });
	const key = {};
	const first = registry.get(key);
	assert.equal(registry.has(key), false);
	assert.notEqual(registry.get(key), first);
});

test('promise values are cached as-is, including rejections', async () => {
	const promise = Promise.reject(Error('failure'));
	const registry = new WeakCacheRegistry(() => promise);
	const key = {};
	assert.equal(registry.get(key), promise);
	await assert.rejects(promise, /failure/);
	assert.equal(registry.get(key), promise);
});
