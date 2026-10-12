import assert from 'node:assert/strict';
import { test } from 'vitest';
import { GenerationalWeakCache } from '@neutrium/utilities/cache';
import { GenerationalWeakCache as RootCache } from '@neutrium/utilities';

test('rotation drops old entries while reads promote hot entries across generations', () => {
    assert.equal(RootCache, GenerationalWeakCache);
    const cache = new GenerationalWeakCache(2);
    const cold = {}, hot = {}, keys = Array.from({ length: 10 }, () => ({}));
    const value = { hot };
    cache.set(cold, 'cold').set(hot, value);
    for (const key of keys) {
        cache.set(key, key);
        assert.equal(cache.get(hot), value);
    }
    assert.equal(cache.has(cold), false);
    assert.equal(cache.get(cold), undefined);
    assert.equal(cache.get(hot), value);
});

test('peek and has do not promote; rotation occurs on the next new entry after capacity', () => {
    const cache = new GenerationalWeakCache(2);
    const [a, b, c, d, e] = Array.from({ length: 5 }, () => ({}));
    cache.set(a, 1).set(b, 2).set(c, 3);
    assert.equal(cache.peek(a), 1);
    assert.equal(cache.has(b), true);
    cache.set(d, 4);
    assert.equal(cache.has(a), true);
    cache.set(e, 5);
    assert.equal(cache.has(a), false);
    assert.equal(cache.has(b), false);
    assert.equal(cache.peek(c), 3);
});

test('updates do not consume current capacity and replacement never resurrects stale values', () => {
    const cache = new GenerationalWeakCache(1);
    const a = {}, b = {}, c = {};
    cache.set(a, 1).set(b, 2);
    for (let i = 0; i < 10; i++) cache.set(b, i);
    assert.equal(cache.peek(a), 1);
    cache.set(a, 3); // Promote an updated value while current is full.
    assert.equal(cache.get(a), 3);
    assert.equal(cache.delete(a), true);
    assert.equal(cache.delete(a), false);
    assert.equal(cache.has(a), false);
    cache.set(c, 4);
    assert.equal(cache.has(a), false);
    assert.equal(cache.has(b), false);
});

test('undefined and falsy payloads promote correctly, and function keys are accepted', () => {
    for (const value of [undefined, null, false, 0, '']) {
        const cache = new GenerationalWeakCache(1), key = () => {};
        cache.set(key, value).set({}, 'other');
        assert.equal(cache.get(key), value);
        assert.equal(cache.has(key), true);
        cache.set({}, 'next');
        assert.equal(cache.has(key), true);
        assert.equal(cache.delete(key), true); // Delete from previous.
        assert.equal(cache.has(key), false);
    }
});

test('deletion does not replenish admission slots; clear releases and resets both generations', () => {
    const cache = new GenerationalWeakCache(2);
    const [a, b, c, d, e] = Array.from({ length: 5 }, () => ({}));
    cache.set(a, 1).set(b, 2).set(c, 3);
    cache.delete(c);
    cache.set(d, 4).set(e, 5);
    assert.equal(cache.has(a), false);
    cache.clear();
    for (const key of [a, b, c, d, e]) assert.equal(cache.has(key), false);
    cache.set(a, 1).set(b, 2).set(c, 3).set(d, 4);
    assert.equal(cache.has(a), true);
    cache.set(e, 5);
    assert.equal(cache.has(a), false);
});

test('disabled caches do not retain values, and invalid keys cannot rotate populated generations', () => {
    const disabled = new GenerationalWeakCache(0), key = {};
    assert.equal(disabled.trySet(key, 1), false);
    assert.equal(disabled.set(key, 2), disabled);
    assert.equal(disabled.get(key), undefined);
    assert.equal(disabled.has(key), false);
    const cache = new GenerationalWeakCache(1), a = {}, b = {};
    cache.set(a, 1).set(b, 2);
    for (const key of [null, undefined, 1, 'a', Symbol()]) {
        assert.throws(() => cache.set(key, 3), TypeError);
        assert.throws(() => disabled.set(key, 3), TypeError);
        assert.equal(cache.get(key), undefined);
        assert.equal(cache.peek(key), undefined);
        assert.equal(cache.has(key), false);
        assert.equal(cache.delete(key), false);
    }
    assert.equal(cache.peek(a), 1);
    assert.equal(cache.peek(b), 2);
    for (const value of [-1, 0.5, NaN, Infinity, '1', Number.MAX_SAFE_INTEGER + 1])
        assert.throws(() => new GenerationalWeakCache(value), RangeError);
});
