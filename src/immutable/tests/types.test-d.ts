import { expectTypeOf, test } from 'vitest';
import { immutableSnapshot, type DeepReadonly } from '@neutrium/utilities/immutable';
import { immutableSnapshot as rootSnapshot } from '@neutrium/utilities';

test('snapshots expose deeply readonly records, arrays and tuples', () => {
	const source = { nested: { n: 1 }, list: [{ n: 2 }], tuple: [1, 'a'] as [number, string] };
	const result = immutableSnapshot(source);
	expectTypeOf(result).toEqualTypeOf<DeepReadonly<typeof source>>();
	expectTypeOf(result.tuple).toEqualTypeOf<readonly [number, string]>();
	expectTypeOf(rootSnapshot).toEqualTypeOf<typeof immutableSnapshot>();
	// @ts-expect-error nested records are immutable
	result.nested.n = 3;
	// @ts-expect-error arrays cannot be mutated
	result.list.push({ n: 3 });
	// @ts-expect-error array elements are immutable
	result.list[0].n = 3;
	// @ts-expect-error tuples are immutable
	result.tuple[0] = 2;
	expectTypeOf(immutableSnapshot(1 as const)).toEqualTypeOf<1>();
});
