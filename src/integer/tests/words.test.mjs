import { expect, test } from 'vitest';
import { rotateLeft32, rotateRight32, splitUint64, joinUint64 } from '@neutrium/utilities/integer';
import * as root from '@neutrium/utilities';

test('rotations match an independent BigInt reference for boundaries and signed shifts', () => {
    for (const word of [0, 1, 0x80000000, 0xffffffff, 0x12345678, 0xaaaaaaaa]) {
        for (const shift of [-Number.MAX_SAFE_INTEGER, ...Array.from({ length: 131 }, (_, i) => i - 65), Number.MAX_SAFE_INTEGER]) {
            const count = BigInt(((shift % 32) + 32) % 32), value = BigInt(word);
            const expected = Number(((value << count) | (value >> (32n - count))) & 0xffffffffn);
            expect(rotateLeft32(word, shift)).toBe(expected);
            expect(rotateRight32(word, -shift)).toBe(expected);
            expect(rotateRight32(rotateLeft32(word, shift), shift)).toBe(word);
        }
    }
    expect(Object.is(rotateLeft32(-0, 0), 0)).toBe(true);
});

test('split and join use low, high word order without losing precision', () => {
    expect(splitUint64(0x123456789abcdef0n)).toEqual([0x9abcdef0, 0x12345678]);
    for (const word of [0n, 1n, 0xffffffffn, 0x100000000n, 0x8000000000000000n, 0xffffffffffffffffn]) {
        expect(joinUint64(...splitUint64(word))).toBe(word);
    }
    expect(joinUint64(0xffffffff, 0xffffffff)).toBe(0xffffffffffffffffn);
    for (const [name, helper] of Object.entries({ rotateLeft32, rotateRight32, splitUint64, joinUint64 })) expect(root[name]).toBe(helper);
});

test('invalid words and shifts are rejected without coercion or truncation', () => {
    for (const value of [-1, 2 ** 32, 1.5, NaN, Infinity, '1', 1n, null, {}]) {
        expect(() => rotateLeft32(value, 1)).toThrow(RangeError);
        expect(() => rotateRight32(value, 1)).toThrow(RangeError);
        expect(() => joinUint64(value, 0)).toThrow(RangeError);
        expect(() => joinUint64(0, value)).toThrow(RangeError);
    }
    for (const shift of [0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', 1n]) {
        expect(() => rotateLeft32(1, shift)).toThrow(RangeError);
        expect(() => rotateRight32(1, shift)).toThrow(RangeError);
    }
    for (const value of [-1n, 1n << 64n]) expect(() => splitUint64(value)).toThrow(RangeError);
    for (const value of [1, '1', null]) expect(() => splitUint64(value)).toThrow(TypeError);
});
