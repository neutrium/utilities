import { expectTypeOf, test } from 'vitest';
import { gcdBigInt, lcmBigInt, divFloorBigInt, divCeilBigInt, moduloBigInt } from '@neutrium/utilities/integer';
import { gcdBigInt as rootGcd } from '@neutrium/utilities';

test('integer public type contract', () => {
    const gcd: bigint = rootGcd(18n, 24n);
    for (const helper of [gcdBigInt, lcmBigInt, divFloorBigInt, divCeilBigInt, moduloBigInt]) {
        const result: bigint = helper(7n, 3n);
        // @ts-expect-error no implicit Number conversion
        helper(7, 3n);
        // @ts-expect-error no implicit string conversion
        helper(7n, '3');
        // @ts-expect-error outputs remain bigint
        const number: number = helper(7n, 3n);
        void [result, number];
    }
    void gcd;
    expectTypeOf(gcdBigInt(18n, 24n)).toEqualTypeOf<bigint>();
});
