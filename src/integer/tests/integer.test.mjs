import assert from 'node:assert/strict';
import { test } from 'vitest';
import * as integer from '@neutrium/utilities/integer';
import * as root from '@neutrium/utilities';
const { gcdBigInt, lcmBigInt, divFloorBigInt, divCeilBigInt, moduloBigInt } = integer;

test('GCD and LCM normalize signs and handle zeros and coprime inputs', () => {
    for (const [a, b, gcd, lcm] of [[0n, 0n, 0n, 0n], [0n, -12n, 12n, 0n],
        [-18n, 0n, 18n, 0n], [18n, 24n, 6n, 72n], [-18n, 24n, 6n, 72n],
        [18n, -24n, 6n, 72n], [-18n, -24n, 6n, 72n], [7n, 13n, 1n, 91n], [9n, 9n, 9n, 9n]]) {
        assert.equal(gcdBigInt(a, b), gcd);
        assert.equal(lcmBigInt(a, b), lcm);
    }
});

test('arithmetic remains exact well beyond Number precision', () => {
    const factor = 10n ** 200n + 1n;
    assert.equal(gcdBigInt(18n * factor, 24n * factor), 6n * factor);
    assert.equal(lcmBigInt(18n * factor, 24n * factor), 72n * factor);
    const value = 10n ** 200n;
    assert.equal(divFloorBigInt(-value - 1n, value), -2n);
    assert.equal(divCeilBigInt(-value - 1n, value), -1n);
    assert.equal(moduloBigInt(-value - 1n, value), value - 1n);
});

test('floor, ceiling and modulo handle every sign combination and exact division', () => {
    for (const [a, b, floor, ceil, mod] of [[7n, 3n, 2n, 3n, 1n], [-7n, 3n, -3n, -2n, 2n],
        [7n, -3n, -3n, -2n, 1n], [-7n, -3n, 2n, 3n, 2n],
        [6n, 3n, 2n, 2n, 0n], [-6n, 3n, -2n, -2n, 0n], [6n, -3n, -2n, -2n, 0n],
        [-6n, -3n, 2n, 2n, 0n], [0n, -3n, 0n, 0n, 0n], [1n, 3n, 0n, 1n, 1n],
        [-1n, 3n, -1n, 0n, 2n]]) {
        assert.equal(divFloorBigInt(a, b), floor);
        assert.equal(divCeilBigInt(a, b), ceil);
        assert.equal(moduloBigInt(a, b), mod);
    }
});

test('small-domain results agree with independent numeric and divisor references', () => {
    for (let a = -25; a <= 25; a++) for (let b = -25; b <= 25; b++) {
        const x = BigInt(a), y = BigInt(b);
        let expected = 0;
        for (let d = 1; d <= Math.max(Math.abs(a), Math.abs(b)); d++)
            if (a % d === 0 && b % d === 0) expected = d;
        assert.equal(gcdBigInt(x, y), BigInt(expected));
        assert.equal(gcdBigInt(x, y) * lcmBigInt(x, y), BigInt(Math.abs(a * b)));
        if (b === 0) continue;
        assert.equal(divFloorBigInt(x, y), BigInt(Math.floor(a / b)));
        assert.equal(divCeilBigInt(x, y), BigInt(Math.ceil(a / b)));
        const remainder = moduloBigInt(x, y);
        assert.ok(remainder >= 0n && remainder < BigInt(Math.abs(b)));
        assert.equal((x - remainder) % y, 0n);
    }
});

test('BigInt arithmetic helpers reject non-bigint inputs without coercion, including short-circuit zeros', () => {
    const coercible = { [Symbol.toPrimitive]() { throw Error('must not coerce'); } };
    for (const fn of [gcdBigInt, lcmBigInt, divFloorBigInt, divCeilBigInt, moduloBigInt]) for (const invalid of [0, 1, NaN, Infinity, '1', true, null, undefined, Object(1n), coercible]) {
        assert.throws(() => fn(invalid, 1n), TypeError);
        assert.throws(() => fn(0n, invalid), TypeError);
    }
    for (const fn of [divFloorBigInt, divCeilBigInt, moduloBigInt])
        assert.throws(() => fn(0n, 0n), { name: 'RangeError', message: 'divisor must be nonzero' });
});

test('root and feature exports share helper implementations', () => {
    for (const [name, value] of Object.entries(integer)) assert.equal(root[name], value);
});
