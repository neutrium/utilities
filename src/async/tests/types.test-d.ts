import { expectTypeOf, test } from 'vitest';
import { SerialOperationQueue } from '@neutrium/utilities/async';
import { SerialOperationQueue as RootQueue } from '@neutrium/utilities';

test('async public type contract', () => {
	const queue: RootQueue = new SerialOperationQueue('closed');
	const sync: Promise<number> = queue.run(() => 42);
	const asyncValue: Promise<string> = queue.run(async () => 'value');
	const thenable: PromiseLike<number> = Promise.resolve(1);
	const adopted: Promise<number> = queue.run(() => thenable);
	const union: Promise<string | number> = queue.run(() => Math.random() > 0.5 ? 'a' : Promise.resolve(1));
	const idle: Promise<void> = queue.onIdle();
	const closed: boolean = queue.closed;
	const cleanup: Promise<void> = queue.dispose(async () => {});
	const noCleanup: Promise<void> = queue.dispose();
	// @ts-expect-error operation must be callable
	queue.run(Promise.resolve(1));
	// @ts-expect-error return type is inferred
	const incorrect: Promise<string> = queue.run(() => 1);
	// @ts-expect-error cleanup must not return a scalar
	queue.dispose(() => 42);
	// @ts-expect-error lifecycle state is readonly
	queue.closed = false;
	void [sync, asyncValue, adopted, union, idle, closed, cleanup, noCleanup, incorrect];
	expectTypeOf(queue.run(() => 42)).toEqualTypeOf<Promise<number>>();
	expectTypeOf(queue.run(() => thenable)).toEqualTypeOf<Promise<number>>();
});
