import { expectTypeOf, test } from 'vitest';
import { rotateLeft32, rotateRight32, splitUint64, joinUint64 } from '@neutrium/utilities/integer';

test('word helpers distinguish bigint values and number words', () => {
    expectTypeOf(rotateLeft32(1, 2)).toEqualTypeOf<number>();
    expectTypeOf(rotateRight32(1, 2)).toEqualTypeOf<number>();
    expectTypeOf(splitUint64(1n)).toEqualTypeOf<readonly [number, number]>();
    expectTypeOf(joinUint64(1, 2)).toEqualTypeOf<bigint>();
    // @ts-expect-error full width input requires bigint
    splitUint64(1);
    // @ts-expect-error words require numbers
    joinUint64(1n, 2n);
    // @ts-expect-error shifts require numbers
    rotateLeft32(1, 2n);
});
