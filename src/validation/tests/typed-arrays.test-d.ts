import { expectTypeOf, test } from 'vitest';
import { isFloat32Array, isFloat64Array, isUint8Array, isUint32Array } from '@neutrium/utilities/validation';

test('typed-array guards narrow unknown values', () => {
	function check(value: unknown) {
		if (isFloat32Array(value)) expectTypeOf(value).toEqualTypeOf<Float32Array>();
		if (isFloat64Array(value)) expectTypeOf(value).toEqualTypeOf<Float64Array>();
		if (isUint8Array(value)) expectTypeOf(value).toEqualTypeOf<Uint8Array>();
		if (isUint32Array(value)) expectTypeOf(value).toEqualTypeOf<Uint32Array>();
		// @ts-expect-error narrowing is limited to guarded branches
		value.byteLength;
	}
	void check;
});
