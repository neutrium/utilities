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
		#keyCopies = 0;
		entryOverheadBytes = 0;
		measure() { return this.#bytes; }
		accept(key) { return key !== this.#blocked; }
		detach(value) { this.#copies++; return { ...value }; }
		detachKey(key) { this.#keyCopies++; return key; }
		get keyCopies() { return this.#keyCopies; }
		get copies() { return this.#copies; }
	}
	const policy = new Policy();
	const cache = new BudgetCache({ maxBytes: 10 }, policy);
	policy.measure = () => 0;
	policy.accept = () => true;
	policy.detach = value => value;
	policy.detachKey = () => { throw Error("must use captured method"); };
	policy.entryOverheadBytes = 100;
	const value = { payload: 42 };
	assert.equal(cache.trySet('reject', value), false);
	assert.equal(policy.copies, 0);
	assert.equal(policy.keyCopies, 0);
	assert.equal(cache.trySet('a', value), true);
	assert.equal(cache.weight, 4);
	assert.deepEqual(cache.peek('a'), value);
	assert.notEqual(cache.peek('a'), value);
	assert.equal(policy.copies, 1);
	assert.equal(policy.keyCopies, 1);
});

test('inherited admission hooks are not dropped when measure is an own property', () => {
	const policy = Object.assign(Object.create({ accept() { return false; } }), {
		measure: () => { throw Error('must not measure rejected values'); },
	});
	const cache = new BudgetCache({}, policy);
	assert.equal(cache.trySet('key', 42), false);
	assert.equal(cache.size, 0);
	for (const name of ['accept', 'detach', 'detachKey']) {
		const invalid = Object.assign(Object.create({ [name]: false }), { measure: () => 0 });
		assert.throws(() => new BudgetCache({}, invalid), TypeError);
	}
});

test('admission precedes measuring; oversized entries do not detach or disturb existing values', () => {
	let measurements = 0, copies = 0, keyCopies = 0;
	const cache = new BudgetCache({ maxBytes: 10 }, {
		entryOverheadBytes: 0,
		accept: key => key !== 'reject',
		measure: value => { measurements++; return value.bytes; },
		detach: value => { copies++; return { ...value }; },
		detachKey: key => { keyCopies++; return key; },
	});
	const original = { bytes: 2 };
	cache.set('a', original).set('b', { bytes: 2 });
	assert.notEqual(cache.peek('a'), original);
	assert.equal(cache.trySet('reject', { bytes: 0 }), false);
	assert.equal(cache.trySet('key-too-long', { bytes: 0 }), false);
	assert.equal(measurements, 2);
	assert.equal(cache.trySet('a', { bytes: 9 }), false);
	assert.equal(copies, 2);
	assert.equal(keyCopies, 2);
	assert.deepEqual([...cache.keys()], ['a', 'b']);
	assert.equal(cache.weight, 8);
	assert.deepEqual(cache.peek('a'), original);
});

test('callback errors and invalid measurements preserve the cache', () => {
	for (const stage of ['accept', 'measure', 'detachKey', 'detach']) {
		let fail = false;
		const cache = new BudgetCache({ maxBytes: 10 }, {
			entryOverheadBytes: 0,
			accept: () => { if (fail && stage === 'accept') throw Error('failure'); return true; },
			measure: () => { if (fail && stage === 'measure') throw Error('failure'); return 1; },
			detach: value => { if (fail && stage === 'detach') throw Error('failure'); return value; },
			detachKey: key => { if (fail && stage === 'detachKey') throw Error('failure'); return key; },
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
		const unused = () => { throw Error('not called'); };
		const policy = { measure: unused, accept: unused, detach: unused, detachKey: unused };
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


test('key copying follows admission and precedes payload copying and storage allocation', () => {
	const calls = [];
	const cache = new BudgetCache({ maxBytes: 10 }, {
		entryOverheadBytes: 0,
		accept: () => { calls.push('accept'); return true; },
		measure: () => { calls.push('measure'); return 1; },
		detachKey: key => {
			calls.push('key');
			assert.equal(cache.entries, undefined);
			return JSON.parse(JSON.stringify(key));
		},
		detach: value => { calls.push('value'); return { ...value }; },
	});
	assert.equal(cache.trySet('oversized', {}), false);
	assert.equal(cache.entries, undefined);
	assert.deepEqual(calls, ['accept']);
	calls.length = 0;
	const payload = { value: 1 };
	assert.equal(cache.trySet('a', payload), true);
	assert.deepEqual(calls, ['accept', 'measure', 'key', 'value']);
	assert.deepEqual(cache.peek('a'), payload);
	assert.notEqual(cache.peek('a'), payload);
	cache.clear();
	assert.equal(cache.entries, undefined);
});

test('key copies cannot normalize keys or change their type or mutate cache state on failure', () => {
	for (const invalid of ['b', 'longer', undefined, null, 1, new String('a')]) {
		let fail = false, payloadCopies = 0;
		const cache = new BudgetCache({ maxEntries: 2 }, {
			measure: () => 0,
			detachKey: key => fail ? invalid : key,
			detach: value => { payloadCopies++; return value; },
		});
		cache.set('a', 1).set('b', 2);
		const before = cache.stats;
		fail = true;
		assert.throws(() => cache.trySet('a', 3), /detachKey must return the same string value/);
		assert.deepEqual([...cache.keys()], ['a', 'b']);
		assert.deepEqual(cache.stats, before);
		assert.equal(cache.peek('a'), 1);
		assert.equal(payloadCopies, 2);
	}
	const cache = new BudgetCache({}, { measure: () => 0, detachKey: () => { throw Error('copy failed'); } });
	assert.throws(() => cache.trySet('a', 1), /copy failed/);
	assert.equal(cache.entries, undefined);
});


test('cache configuration reuse is opt-in and follows validated identity rather than equal limits', () => {
    const parent = cacheConfig({ maxEntries: 3 });
    assert.notEqual(cacheConfig(undefined, parent), parent);
    assert.notEqual(cacheConfig(parent), parent);
    assert.notEqual(cacheConfig(), DEFAULT_CACHE_CONFIG);
    const options = { name: 'cache.parser', reuse: true };
    assert.equal(cacheConfig(undefined, parent, options), parent);
    assert.equal(cacheConfig(parent, DEFAULT_CACHE_CONFIG, options), parent);
    assert.equal(cacheConfig(undefined, undefined, options), DEFAULT_CACHE_CONFIG);
    // An explicit override still creates an independent scope even if it changes nothing.
    for (const input of [{}, { maxEntries: undefined }, { maxEntries: 3 }]) {
        const result = cacheConfig(input, parent, options);
        assert.notEqual(result, parent);
        assert.deepEqual(result, parent);
        assert.equal(cacheConfig(result, undefined, options), result);
        assert.equal(Object.isFrozen(result), true);
    }
});

test('reuse validates and snapshots unknown parents and never trusts arbitrary frozen objects', () => {
    const options = { reuse: true };
    const parent = { maxEntries: 3, maxBytes: 512 };
    const resolved = cacheConfig(undefined, parent, options);
    assert.notEqual(resolved, parent);
    parent.maxEntries = 0;
    assert.equal(resolved.maxEntries, 3);
    assert.equal(Object.isFrozen(resolved), true);
    const frozen = Object.freeze({ maxEntries: 3, maxBytes: 512 });
    assert.notEqual(cacheConfig(frozen, undefined, options), frozen);
    assert.notEqual(cacheConfig(undefined, frozen, options), frozen);
    let reads = 0;
    const accessor = Object.freeze({ get maxEntries() { reads++; return 3; }, maxBytes: 512 });
    for (const invalid of [null, [], 1, {}, { maxEntries: 3 },
        Object.freeze({ maxEntries: -1, maxBytes: 512 }),
        Object.freeze({ maxEntries: 3, maxBytes: 512, extra: true }), accessor]) {
        assert.throws(() => cacheConfig(undefined, invalid, options));
        assert.throws(() => cacheConfig(DEFAULT_CACHE_CONFIG, invalid, options));
    }
    assert.throws(() => cacheConfig(accessor, undefined, options), TypeError);
    assert.equal(reads, 0);
});

test('cache diagnostic labels apply to unknown options, records and limits', () => {
    const options = { name: 'cache.parser', reuse: true };
    assert.throws(() => cacheConfig({ maxByte: 1 }, undefined, options), /Unknown cache\.parser option: maxByte/);
    assert.throws(() => cacheConfig({ maxBytes: -1 }, undefined, options), /cache\.parser maxBytes/);
    assert.throws(() => cacheConfig(null, undefined, options), /cache\.parser/);
    assert.throws(() => cacheConfig(undefined, { maxEntries: -1, maxBytes: 10 }, options), /cache\.parser maxEntries/);
    for (const invalid of [{ reuse: 'yes' }, { name: 2 }, { reUse: true }, null])
        assert.throws(() => cacheConfig(undefined, undefined, invalid), TypeError);
});
