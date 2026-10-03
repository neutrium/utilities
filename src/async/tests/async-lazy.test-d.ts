import { expectTypeOf, test } from 'vitest';
import { AsyncLazy } from '@neutrium/utilities/async';
import { AsyncLazy as RootLazy } from '@neutrium/utilities';

test('AsyncLazy infers fulfilled types from synchronous and asynchronous factories', () => {
	expectTypeOf(new AsyncLazy(() => 42).get()).toEqualTypeOf<Promise<number>>();
	expectTypeOf(new AsyncLazy(async () => 'value').get()).toEqualTypeOf<Promise<string>>();
	expectTypeOf(new AsyncLazy<Promise<number>>(() => Promise.resolve(1)).get()).toEqualTypeOf<Promise<number>>();
	const thenable: PromiseLike<number> = Promise.resolve(1);
	expectTypeOf(new AsyncLazy(() => thenable).get()).toEqualTypeOf<Promise<number>>();
	expectTypeOf(new AsyncLazy(() => undefined).get()).toEqualTypeOf<Promise<undefined>>();
	const lazy: RootLazy<number> = new AsyncLazy(() => 42, value => {
		expectTypeOf(value).toEqualTypeOf<number>();
		return value > 0;
	});
	expectTypeOf(lazy.clear()).toEqualTypeOf<void>();
	// @ts-expect-error factory must be callable
	new AsyncLazy(Promise.resolve(1));
	// @ts-expect-error retention predicates must be synchronous
	new AsyncLazy(() => 1, async () => true);
	// @ts-expect-error retention predicates must return boolean
	new AsyncLazy(() => 1, () => 1);
});
