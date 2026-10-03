import { test } from 'vitest';
import { isNonNegativeSafeInteger,
	isPositiveSafeInteger, isUint32, isInRange,
	isPlainRecord, assertFiniteNumber, assertInteger,
	assertSafeInteger, assertNonNegativeSafeInteger, assertPositiveSafeInteger,
	assertUint32, assertInRange, assertString, assertBoolean, assertBigInt,
	assertDefined, assertPlainRecord, assertOneOf, assertKnownKeys } from '@neutrium/utilities/validation';

test('validation public type contract', () => {
	function guards(value: unknown): void {
		if (isNonNegativeSafeInteger(value)) value.toFixed();
		if (isPositiveSafeInteger(value)) value.toFixed();
		if (isUint32(value)) value.toFixed();
		if (isInRange(value, 0, 1)) value.toFixed();
		if (isPlainRecord(value)) { const field: unknown = value.field; void field; }
		// @ts-expect-error guards must not narrow outside their branches
		value.toFixed();
	}

	function assertions(a: unknown, b: unknown, c: unknown, d: unknown, e: unknown, f: unknown, g: unknown): void {
		assertFiniteNumber(a); a.toFixed();
		assertInteger(b); b.toFixed();
		assertSafeInteger(c); c.toFixed();
		assertNonNegativeSafeInteger(d); d.toFixed();
		assertPositiveSafeInteger(e); e.toFixed();
		assertUint32(f); f.toFixed();
		assertInRange(g, 0, 1); g.toFixed();
	}

	function otherAssertions(a: unknown, b: unknown, c: unknown, d: unknown, e: unknown, f: unknown): void {
		assertString(a); a.toUpperCase();
		assertBoolean(b); const bool: boolean = b;
		assertBigInt(c); const big: bigint = c;
		assertPlainRecord(d); const field: unknown = d.field;
		assertOneOf(e, ['fast', 'precise']); const mode: 'fast' | 'precise' = e;
		assertKnownKeys(f, ['optional']); const optional: unknown = f.optional;
		// @ts-expect-error validating keys does not validate field values
		const invalid: number = f.optional;
		void [bool, big, field, mode, optional, invalid];
	}

	function defined(value: string | null | undefined): string {
		assertDefined(value);
		return value.toUpperCase();
	}
	void [guards, assertions, otherAssertions, defined];
});
