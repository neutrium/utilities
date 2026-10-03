import assert from 'node:assert/strict';
import { test } from 'vitest';
import { SerialOperationQueue } from '@neutrium/utilities/async';
import { SerialOperationQueue as RootQueue } from '@neutrium/utilities';

const deferred = () => Promise.withResolvers();

test('operations start asynchronously and run in invocation order without overlap', async () => {
	const queue = new SerialOperationQueue();
	const gate = deferred(), entered = deferred(), events = [];
	let active = 0;
	const first = queue.run(async () => {
		assert.equal(++active, 1);
		events.push('first start'); entered.resolve();
		await gate.promise;
		events.push('first end'); active--;
		return 10;
	});
	const second = queue.run(() => {
		assert.equal(++active, 1);
		events.push('second'); active--;
		return 20;
	});

	assert.deepEqual(events, []);
	await entered.promise;
	assert.deepEqual(events, ['first start']);
	gate.resolve();
	assert.deepEqual(await Promise.all([first, second]), [10, 20]);
	assert.deepEqual(events, ['first start', 'first end', 'second']);
	assert.equal(queue.closed, false);
});

test('synchronous throws and asynchronous rejections preserve reasons and do not poison later work', async () => {
	const queue = new SerialOperationQueue();
	const firstError = new Error('sync'), secondError = { reason: 'async' };
	const first = queue.run(() => { throw firstError; });
	const second = queue.run(async () => { throw secondError; });
	const third = queue.run(() => 42);
	const results = await Promise.allSettled([first, second, third]);
	assert.equal(results[0].reason, firstError);
	assert.equal(results[1].reason, secondError);
	assert.deepEqual(results[2], { status: 'fulfilled', value: 42 });
	assert.equal(await queue.onIdle(), undefined);
});

test('thenables are awaited before the next operation and values keep identity', async () => {
	const queue = new SerialOperationQueue(), gate = deferred(), events = [];
	const value = {};
	const first = queue.run(() => ({ then(resolve, reject) { gate.promise.then(() => resolve(value), reject); } }));
	const second = queue.run(() => { events.push('second'); });
	await Promise.resolve();
	assert.deepEqual(events, []);
	gate.resolve();
	assert.equal(await first, value);
	await second;
	assert.deepEqual(events, ['second']);
});

test('throwing thenable accessors reject the operation and release the queue', async () => {
	const queue = new SerialOperationQueue();
	const error = new Error('then getter');
	const failed = queue.run(() => ({ get then() { throw error; } }));
	const next = queue.run(() => 1);
	await assert.rejects(failed, reason => reason === error);
	assert.equal(await next, 1);
});

test('disposal closes admission immediately, drains accepted work and executes cleanup once', async () => {
	const queue = new SerialOperationQueue('Rand resource has been destroyed');
	const gate = deferred(), events = [];
	const work = queue.run(async () => { await gate.promise; events.push('work'); });
	const queued = queue.run(() => events.push('queued'));
	const dispose = queue.dispose(() => { events.push('dispose'); });
	assert.equal(queue.closed, true);
	assert.equal(queue.dispose(() => { throw Error('must not execute'); }), dispose);
	await assert.rejects(queue.run(() => { throw Error('must not execute'); }), /Rand resource has been destroyed/);
	assert.deepEqual(events, []);
	gate.resolve();
	await Promise.all([work, queued, dispose]);
	assert.deepEqual(events, ['work', 'queued', 'dispose']);
	assert.equal(queue.dispose(), dispose);
});

test('cleanup runs after failed work and its asynchronous completion is awaited', async () => {
	const queue = new SerialOperationQueue(), gate = deferred(), entered = deferred();
	const failed = queue.run(() => { throw Error('work failure'); });
	const cleanup = queue.dispose(async () => { entered.resolve(); await gate.promise; });
	const rejected = assert.rejects(failed, /work failure/);
	let finished = false;
	cleanup.then(() => { finished = true; });
	await entered.promise;
	assert.equal(finished, false);
	gate.resolve();
	await Promise.all([rejected, cleanup]);
	assert.equal(finished, true);
});

test('failed cleanup remains terminal and is never retried', async () => {
	const queue = new SerialOperationQueue();
	const error = new Error('cleanup failure');
	const cleanup = queue.dispose(() => { throw error; });
	await assert.rejects(cleanup, reason => reason === error);
	assert.equal(queue.dispose(() => { throw Error('retry'); }), cleanup);
	await queue.onIdle(); // completion, not a success check
	await assert.rejects(queue.run(() => 1), /closed/);
	assert.equal(queue.closed, true);
});

test('onIdle snapshots prior submissions without waiting for later work', async () => {
	const queue = new SerialOperationQueue(), gate = deferred();
	await queue.onIdle();
	const first = queue.run(() => 1);
	const idle = queue.onIdle();
	const later = queue.run(() => gate.promise);
	let laterSettled = false;
	later.then(() => { laterSettled = true; });
	await idle;
	assert.equal(await first, 1);
	assert.equal(laterSettled, false);
	gate.resolve();
	await later;
	assert.equal(queue.closed, false);
});

test('onIdle after disposal includes cleanup while an earlier snapshot excludes it', async () => {
	const queue = new SerialOperationQueue(), gate = deferred();
	const before = queue.onIdle();
	const disposal = queue.dispose(() => gate.promise);
	const after = queue.onIdle();
	let afterSettled = false;
	after.then(() => { afterSettled = true; });
	await before;
	assert.equal(afterSettled, false);
	gate.resolve();
	await Promise.all([after, disposal]);
	assert.equal(afterSettled, true);
});

test('an operation may schedule later work without awaiting it', async () => {
	const queue = new SerialOperationQueue(), events = [];
	let nested;
	const first = queue.run(() => {
		events.push('first');
		nested = queue.run(() => events.push('nested'));
	});
	const second = queue.run(() => events.push('second'));
	await first;
	await Promise.all([second, nested]);
	assert.deepEqual(events, ['first', 'second', 'nested']);
});

test('disposal may be requested inside an operation without awaiting it', async () => {
	const queue = new SerialOperationQueue(), events = [];
	let cleanup;
	await queue.run(() => {
		cleanup = queue.dispose(() => { events.push('cleanup'); });
		events.push('work');
	});
	await cleanup;
	assert.deepEqual(events, ['work', 'cleanup']);
});

test('invalid callbacks reject without closing or blocking the queue', async () => {
	const queue = new SerialOperationQueue();
	await assert.rejects(queue.run(null), TypeError);
	await assert.rejects(queue.dispose(null), TypeError);
	assert.equal(queue.closed, false);
	assert.equal(await queue.run(() => 42), 42);
	await queue.dispose();
	assert.equal(queue.closed, true);
	await assert.rejects(queue.dispose(null), TypeError);
	assert.equal(queue.dispose(), queue.dispose());
});

test('instances are independent and the root export shares the implementation', async () => {
	assert.equal(RootQueue, SerialOperationQueue);
	const a = new SerialOperationQueue(), b = new SerialOperationQueue(), gate = deferred();
	const blocked = a.run(() => gate.promise);
	assert.equal(await b.run(() => 2), 2);
	gate.resolve();
	await blocked;
	await a.dispose();
	assert.equal(b.closed, false);
});
