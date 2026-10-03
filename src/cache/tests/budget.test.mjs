import assert from 'node:assert/strict';
import { test } from 'vitest';
import { BudgetCache, cacheConfig, DEFAULT_CACHE_CONFIG } from '@neutrium/utilities/cache';

test('configuration copies and freezes limits, inherits defaults and rejects invalid fields', () => {
	const input = { maxEntries: 2 };
	const config = cacheConfig(input);
	input.maxEntries = 100;
	assert.deepEqual(config, { maxEntries: 2, maxBytes: 4 * 1024 * 1024 });
	assert.equal(Object.isFrozen(config), true);
	assert.equal(Object.isFrozen(DEFAULT_CACHE_CONFIG), true);
	assert.deepEqual(cacheConfig({ maxBytes: 0 }, config), { maxEntries: 2, maxBytes: 0 });
	for (const value of [null, [], 1, { wrong: 1 }, { [Symbol()]: 1 }])
		assert.throws(() => cacheConfig(value), TypeError);
	for (const key of ['maxEntries', 'maxBytes'])
		for (const value of [null, -1, NaN, Infinity, 0.1, '1', Number.MAX_SAFE_INTEGER + 1])
			assert.throws(() => cacheConfig({ [key]: value }), RangeError);
});

test('byte cost includes key UTF-16 units and configured overhead; limits are detached', () => {
	const config = { maxEntries: 3, maxBytes: 12 };
	const policy = { entryOverheadBytes: 2, measure: value => value.length * 2 };
	const cache = new BudgetCache(config, policy);
	config.maxBytes = 100;
	policy.measure = () => 0;
	assert.equal(cache.set('a', 'xy'), cache); // 2 + 2 + 4 = 8
	assert.equal(cache.weight, 8);
	cache.set('😀', 'x'); // 2 + 4 + 2 = 8, evicts a
	assert.equal(cache.has('a'), false);
	assert.equal(cache.weight, 8);
	assert.equal(new BudgetCache({}, { measure: () => 0 }).set('a', 1).weight, 258);
});

test('prototype policy methods retain their receiver and captured references', () => {
	class Policy {
		#bytes = 2;
		#blocked = 'reject';
		#copies = 0;
		entryOverheadBytes = 0;
		measure() { return this.#bytes; }
		accept(key) { return key !== this.#blocked; }
		detach(value) { this.#copies++; return { ...value }; }
		get copies() { return this.#copies; }
	}
	const policy = new Policy();
	const cache = new BudgetCache({ maxBytes: 10 }, policy);
	policy.measure = () => 0;
	policy.accept = () => true;
	policy.detach = value => value;
	policy.entryOverheadBytes = 100;
	const value = { payload: 42 };
	assert.equal(cache.trySet('reject', value), false);
	assert.equal(policy.copies, 0);
	assert.equal(cache.trySet('a', value), true);
	assert.equal(cache.weight, 4);
	assert.deepEqual(cache.peek('a'), value);
	assert.notEqual(cache.peek('a'), value);
	assert.equal(policy.copies, 1);
});

test('inherited admission hooks are not dropped when measure is an own property', () => {
	const policy = Object.assign(Object.create({ accept() { return false; } }), {
		measure: () => { throw Error('must not measure rejected values'); },
	});
	const cache = new BudgetCache({}, policy);
	assert.equal(cache.trySet('key', 42), false);
	assert.equal(cache.size, 0);
	for (const name of ['accept', 'detach']) {
		const invalid = Object.assign(Object.create({ [name]: false }), { measure: () => 0 });
		assert.throws(() => new BudgetCache({}, invalid), TypeError);
	}
});

test('admission precedes measuring; oversized entries do not detach or disturb existing values', () => {
	let measurements = 0, copies = 0;
	const cache = new BudgetCache({ maxBytes: 10 }, {
		entryOverheadBytes: 0,
		accept: key => key !== 'reject',
		measure: value => { measurements++; return value.bytes; },
		detach: value => { copies++; return { ...value }; },
	});
	const original = { bytes: 2 };
	cache.set('a', original).set('b', { bytes: 2 });
	assert.notEqual(cache.peek('a'), original);
	assert.equal(cache.trySet('reject', { bytes: 0 }), false);
	assert.equal(cache.trySet('key-too-long', { bytes: 0 }), false);
	assert.equal(measurements, 2);
	assert.equal(cache.trySet('a', { bytes: 9 }), false);
	assert.equal(copies, 2);
	assert.deepEqual([...cache.keys()], ['a', 'b']);
	assert.equal(cache.weight, 8);
	assert.deepEqual(cache.peek('a'), original);
});

test('callback errors and invalid measurements preserve the cache', () => {
	for (const stage of ['accept', 'measure', 'detach']) {
		let fail = false;
		const cache = new BudgetCache({ maxBytes: 10 }, {
			entryOverheadBytes: 0,
			accept: () => { if (fail && stage === 'accept') throw Error('failure'); return true; },
			measure: () => { if (fail && stage === 'measure') throw Error('failure'); return 1; },
			detach: value => { if (fail && stage === 'detach') throw Error('failure'); return value; },
		});
		cache.set('a', 1).set('b', 2);
		fail = true;
		assert.throws(() => cache.set('a', 3), /failure/);
		assert.deepEqual([...cache.keys()], ['a', 'b']);
		assert.equal(cache.peek('a'), 1);
		assert.equal(cache.weight, 6);
	}
	for (const value of [-1, 0.1, NaN, Infinity, '1']) {
		const cache = new BudgetCache({}, { measure: () => value });
		assert.throws(() => cache.set('a', 1), RangeError);
		assert.equal(cache.size, 0);
	}
});

test('disabled caches bypass all callbacks and optional creation returns undefined', () => {
	for (const config of [{ maxEntries: 0 }, { maxBytes: 0 }]) {
		const policy = { measure: () => { throw Error('not called'); } };
		const cache = new BudgetCache(config, policy);
		assert.equal(cache.trySet('a', 1), false);
		assert.equal(cache.size, 0);
		assert.equal(BudgetCache.create(config, policy), undefined);
	}
	assert.ok(BudgetCache.create({}, { measure: () => 0 }) instanceof BudgetCache);
	assert.throws(() => new BudgetCache({}, { measure: () => 0, entryOverheadBytes: -1 }), RangeError);
	assert.throws(() => new BudgetCache({}, {}), TypeError);
});

test('undefined payload recency, deletion, clear and immutable stats follow the LRU contract', () => {
	const cache = new BudgetCache({ maxEntries: 2 }, { measure: () => 0 });
	cache.set('a', undefined).set('b', null);
	cache.get('a');
	cache.peek('b'); cache.has('b');
	cache.set('c', 0);
	assert.equal(cache.has('a'), true);
	assert.equal(cache.has('b'), false);
	assert.equal(cache.delete('c'), true);
	assert.equal(cache.delete('c'), false);
	const stats = cache.stats;
	assert.equal(Object.isFrozen(stats), true);
	cache.clear();
	assert.equal(stats.entries, 1);
	assert.equal(cache.stats.estimatedBytes, 0);
	assert.deepEqual([...cache.keys()], []);
	assert.equal(cache.get('a'), undefined);
	assert.equal(cache.has('a'), false);
	assert.equal(cache.trySet('d', 1), true);
});

test('very large payload estimates are rejected without overflowing accounting', () => {
	const cache = new BudgetCache({ maxBytes: Number.MAX_SAFE_INTEGER }, { measure: value => value });
	assert.equal(cache.trySet('a', Number.MAX_SAFE_INTEGER), false);
	assert.equal(cache.trySet('a', Number.MAX_SAFE_INTEGER - 258), true);
	cache.set('b', Number.MAX_SAFE_INTEGER - 258);
	assert.deepEqual([...cache.keys()], ['b']);
	assert.equal(cache.weight, Number.MAX_SAFE_INTEGER);
});
