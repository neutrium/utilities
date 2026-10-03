import { expect, test } from 'vitest';
import { AsyncLazy } from '@neutrium/utilities/async';
import { AsyncLazy as RootLazy } from '@neutrium/utilities';

test('starts lazily in a microtask and shares pending and fulfilled promises', async () => {
	let calls = 0;
	const gate = Promise.withResolvers(), value = {};
	const lazy = new AsyncLazy(() => { calls++; return gate.promise; });
	expect(RootLazy).toBe(AsyncLazy);
	expect(calls).toBe(0);
	const first = lazy.get();
	expect(lazy.get()).toBe(first);
	expect(calls).toBe(0);
	await Promise.resolve();
	expect(calls).toBe(1);
	gate.resolve(value);
	expect(await first).toBe(value);
	expect(lazy.get()).toBe(first);
	expect(await lazy.get()).toBe(value);
});

test('retains all fulfilled values by default, including undefined and false', async () => {
	for (const value of [undefined, null, false, 0, '']) {
		let calls = 0;
		const lazy = new AsyncLazy(() => { calls++; return value; });
		const first = lazy.get();
		expect(await first).toBe(value);
		expect(lazy.get()).toBe(first);
		expect(calls).toBe(1);
	}
});

test('synchronous throws, rejected promises and throwing thenable accessors permit retry', async () => {
	const error = { reason: 'failed' };
	for (const fail of [() => { throw error; }, () => Promise.reject(error), () => ({ get then() { throw error; } })]) {
		let calls = 0;
		const lazy = new AsyncLazy(() => ++calls === 1 ? fail() : 42);
		const first = lazy.get();
		expect(lazy.get()).toBe(first);
		await expect(first).rejects.toBe(error);
		const next = lazy.get();
		expect(next).not.toBe(first);
		expect(await next).toBe(42);
		expect(calls).toBe(2);
	}
});

test('adopts thenables and evaluates the retention predicate once per attempt', async () => {
	let calls = 0, checks = 0;
	const lazy = new AsyncLazy(() => ({ then(resolve) { resolve(++calls > 1); } }), value => { checks++; return value; });
	const first = lazy.get();
	expect(lazy.get()).toBe(first);
	expect(await first).toBe(false);
	const second = lazy.get();
	expect(second).not.toBe(first);
	expect(await second).toBe(true);
	expect(lazy.get()).toBe(second);
	expect(calls).toBe(2);
	expect(checks).toBe(2);
});

test('predicate errors and invalid return types reject and allow retry', async () => {
	for (const predicate of [() => { throw new Error('predicate'); }, () => undefined, () => Promise.resolve(true)]) {
		let checks = 0;
		const lazy = new AsyncLazy(() => 42, value => ++checks === 1 ? predicate(value) : true);
		await expect(lazy.get()).rejects.toBeInstanceOf(Error);
		expect(await lazy.get()).toBe(42);
		expect(checks).toBe(2);
	}
	expect(() => new AsyncLazy(null)).toThrow(TypeError);
	expect(() => new AsyncLazy(() => 1, null)).toThrow(TypeError);
});

test('clear forgets fulfilled values and instances remain independent', async () => {
	let calls = 0;
	const lazy = new AsyncLazy(() => ++calls), other = new AsyncLazy(() => 100);
	const first = lazy.get();
	expect(await first).toBe(1);
	lazy.clear();
	lazy.clear();
	expect(await lazy.get()).toBe(2);
	expect(await other.get()).toBe(100);
});

for (const outcome of ['retained', 'discarded', 'rejected']) {
	test(`an invalidated ${outcome} attempt cannot change a newer attempt`, async () => {
		const old = Promise.withResolvers(), fresh = Promise.withResolvers();
		let calls = 0;
		const lazy = new AsyncLazy(() => ++calls === 1 ? old.promise : fresh.promise, value => value !== false);
		const first = lazy.get();
		// Attach the rejection observer before allowing the attempt to settle.
		const settled = first.then(value => ({ value }), error => ({ error }));
		lazy.clear();
		const second = lazy.get();
		expect(second).not.toBe(first);
		await Promise.resolve();
		expect(calls).toBe(2); // clear does not cancel even an unstarted attempt
		const error = new Error('old');
		if (outcome === 'rejected') old.reject(error);
		else old.resolve(outcome === 'discarded' ? false : 'old');
		expect(await settled).toEqual(outcome === 'rejected' ? { error } : { value: outcome === 'discarded' ? false : 'old' });
		expect(lazy.get()).toBe(second);
		fresh.resolve('new');
		expect(await second).toBe('new');
		expect(lazy.get()).toBe(second);
	});
}

test('clear called from a retention predicate invalidates that result', async () => {
	const lazy = new AsyncLazy(() => 1, () => { lazy.clear(); return true; });
	const first = lazy.get();
	await first;
	expect(lazy.get()).not.toBe(first);
});
