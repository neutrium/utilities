import assert from 'node:assert/strict';
import { test } from 'vitest';
import { LruCache, WeightedLruCache } from '@neutrium/utilities/cache';
import * as root from '@neutrium/utilities';

test('cache entry point and root share constructors', () => {
	assert.equal(root.LruCache, LruCache);
	assert.equal(root.WeightedLruCache, WeightedLruCache);
});

test('get and replacement refresh recency; has, peek and misses do not', () => {
	const cache = new LruCache(2);
	assert.equal(cache.set('a', 1).set('b', 2), cache);
	assert.equal(cache.get('a'), 1);
	assert.deepEqual([...cache.keys()], ['b', 'a']);
	assert.equal(cache.has('b'), true);
	assert.equal(cache.peek('b'), 2);
	assert.equal(cache.get('missing'), undefined);
	cache.set('c', 3);
	assert.deepEqual([...cache.keys()], ['a', 'c']);
	cache.set('a', 4).set('d', 5);
	assert.deepEqual([...cache.keys()], ['a', 'd']);
	assert.equal(cache.get('a'), 4);
	assert.equal(cache.size, 2);
	assert.equal(cache.weight, 2);
});

test('undefined values and keys are supported, including recency and eviction', () => {
	const cache = new LruCache(2);
	cache.set(undefined, undefined).set('b', false);
	assert.equal(cache.get(undefined), undefined);
	assert.equal(cache.has(undefined), true);
	cache.set('c', null);
	assert.equal(cache.has('b'), false);
	cache.set('d', 0);
	assert.equal(cache.has(undefined), false);
	assert.equal(cache.delete('c'), true);
	assert.equal(cache.delete('c'), false);
});

test('keys use Map identity and values are retained by reference', () => {
	const cache = new LruCache(4);
	const key = {}, value = {};
	cache.set(key, value).set(NaN, 1).set(-0, 2);
	assert.equal(cache.get(key), value);
	assert.equal(cache.has({}), false);
	assert.equal(cache.get(NaN), 1);
	assert.equal(cache.get(0), 2);
});

test('invalid capacities throw and zero disables storage without weighing', () => {
	for (const capacity of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '2'])
		assert.throws(() => new LruCache(capacity), { name: /Error$/ });
	for (const option of ['maxWeight', 'maxEntries']) {
		for (const value of [-1, 0.5, Infinity, NaN, null])
			assert.throws(() => new WeightedLruCache({ maxWeight: 10, weigh: () => 1, [option]: value }), RangeError);
	}
	for (const limits of [{ maxEntries: 0, maxWeight: 10 }, { maxEntries: 10, maxWeight: 0 }]) {
		const cache = new WeightedLruCache({ ...limits, weigh: () => { throw Error('not called'); } });
		assert.equal(cache.trySet('a', 1), false);
		assert.equal(cache.size, 0);
	}
	assert.equal(new LruCache(0).trySet('a', 1), false);
	assert.throws(() => new WeightedLruCache({ maxWeight: 1 }), TypeError);
});

test('weighted cache enforces both limits, evicts multiple entries and accounts for replacements', () => {
	const options = { maxEntries: 3, maxWeight: 10, weigh: (_key, value) => value };
	const cache = new WeightedLruCache(options);
	options.maxWeight = 100; // limits were captured
	cache.set('a', 3).set('b', 3).set('c', 3);
	cache.set('d', 7);
	assert.deepEqual([...cache.keys()], ['c', 'd']);
	assert.equal(cache.weight, 10);
	cache.set('d', 1).set('e', 0).set('f', 0);
	assert.deepEqual([...cache.keys()], ['d', 'e', 'f']);
	assert.equal(cache.weight, 1);
	cache.delete('d');
	assert.equal(cache.weight, 0);
});

test('bulk eviction preserves refreshed survivors and replacement accounting, including a full drain', () => {
	const count = 8192;
	const cache = new WeightedLruCache({ maxEntries: count, maxWeight: count, weigh: (_key, value) => value });
	for (let i = 0; i < count; i++) cache.set(i, 1);
	cache.get(0); // Preserve a refreshed entry while evicting most of the cache.
	assert.equal(cache.trySet(count - 1, count - 2), true);
	assert.deepEqual([...cache.keys()], [count - 2, 0, count - 1]);
	assert.equal(cache.peek(count - 2), 1);
	assert.equal(cache.peek(0), 1);
	assert.equal(cache.peek(count - 1), count - 2);
	assert.equal(cache.size, 3);
	assert.equal(cache.weight, count);

	assert.equal(cache.trySet(undefined, count), true);
	assert.deepEqual([...cache.keys()], [undefined]);
	assert.equal(cache.size, 1);
	assert.equal(cache.weight, count);
	assert.equal(cache.trySet('next', count), true);
	assert.deepEqual([...cache.keys()], ['next']);
	assert.equal(cache.weight, count);
});

test('rejected replacements and weighing failures preserve value, recency and accounting', () => {
	const cache = new WeightedLruCache({ maxWeight: 5, weigh: (_key, value) => {
		if (value === 'throw') throw Error('measurement failed');
		return value;
	} });
	cache.set('a', 2).set('b', 3);
	assert.equal(cache.trySet('a', 6), false);
	for (const value of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, 'throw'])
		assert.throws(() => cache.set('a', value));
	assert.deepEqual([...cache.keys()], ['a', 'b']);
	assert.equal(cache.peek('a'), 2);
	assert.equal(cache.weight, 5);
});

test('weight sums cannot overflow safe integers; stats are immutable snapshots; clear resets', () => {
	const cache = new WeightedLruCache({ maxWeight: Number.MAX_SAFE_INTEGER, weigh: (_key, value) => value });
	cache.set('a', Number.MAX_SAFE_INTEGER - 1).set('b', Number.MAX_SAFE_INTEGER - 2);
	assert.deepEqual([...cache.keys()], ['b']);
	assert.equal(cache.weight, Number.MAX_SAFE_INTEGER - 2);
	const stats = cache.stats;
	assert.equal(Object.isFrozen(stats), true);
	cache.clear();
	assert.equal(cache.size, 0);
	assert.equal(cache.weight, 0);
	assert.equal(stats.entries, 1);
	assert.equal(cache.trySet('c', 1), true);
});

test('mixed LRU operations agree with a simple independent reference model', () => {
	const cache = new WeightedLruCache({ maxEntries: 4, maxWeight: 9, weigh: (_key, value) => value });
	let model = [];
	let seed = 73;
	const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
	for (let i = 0; i < 1000; i++) {
		const action = random() % 5, key = random() % 7, value = random() % 12;
		const index = model.findIndex(entry => entry.key === key);
		if (action === 0) {
			assert.equal(cache.trySet(key, value), value <= 9);
			if (value <= 9) {
				model = model.filter(entry => entry.key !== key);
				model.push({ key, value });
				while (model.length > 4 || model.reduce((sum, entry) => sum + entry.value, 0) > 9) model.shift();
			}
		} else if (action === 1) {
			assert.equal(cache.get(key), model[index]?.value);
			if (index >= 0) model.push(...model.splice(index, 1));
		} else if (action === 2) {
			assert.equal(cache.delete(key), index >= 0);
			if (index >= 0) model.splice(index, 1);
		} else if (action === 3) {
			assert.equal(cache.peek(key), model[index]?.value);
		} else if (i % 29 === 0) {
			cache.clear(); model = [];
		}
		assert.deepEqual([...cache.keys()], model.map(entry => entry.key));
		assert.equal(cache.weight, model.reduce((sum, entry) => sum + entry.value, 0));
	}
});
