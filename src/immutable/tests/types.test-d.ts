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

test('root override types replace fields and retain deep readonly types', () => {
	const result = immutableSnapshot({ locale: undefined as string | undefined, size: 1, nested: { n: 1 } },
		{ locale: 'en-US', size: 'large', added: [1, 2] });
	expectTypeOf(result.locale).toEqualTypeOf<string>();
	expectTypeOf(result.size).toEqualTypeOf<string>();
	expectTypeOf(result.nested).toEqualTypeOf<{ readonly n: number }>();
	expectTypeOf(result.added).toEqualTypeOf<readonly number[]>();
	// @ts-expect-error replacement values are readonly
	result.locale = 'fr-FR';
	// @ts-expect-error replacement arrays are readonly
	result.added.push(3);
	// @ts-expect-error override roots must be objects
	immutableSnapshot(1, { n: 1 });
	// @ts-expect-error overrides must be objects
	immutableSnapshot({}, 1);
});

test('optional overrides retain the original field type and unions retain their branches', () => {
	const updates: { value?: string; added?: boolean } = {};
	const result = immutableSnapshot({ value: 1 }, updates);
	expectTypeOf(result.value).toEqualTypeOf<number | string | undefined>();
	expectTypeOf(result.added).toEqualTypeOf<boolean | undefined>();
	const source = {} as { kind: 'a'; a: number } | { kind: 'b'; b: string };
	const union = immutableSnapshot(source, { locale: 'en-US' });
	if (union.kind === 'a') expectTypeOf(union.a).toEqualTypeOf<number>();
	else expectTypeOf(union.b).toEqualTypeOf<string>();
});
