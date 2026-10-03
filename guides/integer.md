---
title: Integer guide
---

# Small integer helpers

Import from `@neutrium/utilities/integer` or the package root. This is a small set of exact BigInt operations and fixed-width word helpers. For the BigInt arithmetic helpers below, inputs need not be small: each accepts two primitive bigints and returns a bigint. Number, string and boxed BigInt inputs throw TypeError without coercion. Convert inputs explicitly at the calling boundary.

| Helper | Contract |
| --- | --- |
| `gcdBigInt(a, b)` | Nonnegative greatest common divisor; `gcdBigInt(0n, 0n) === 0n`. |
| `lcmBigInt(a, b)` | Nonnegative least common multiple; zero if either argument is zero. |
| `divFloorBigInt(a, b)` | Quotient rounded toward negative infinity. |
| `divCeilBigInt(a, b)` | Quotient rounded toward positive infinity. |
| `moduloBigInt(a, b)` | Euclidean remainder in `[0, abs(b))`, for either sign of b. |

Division and modulo throw RangeError for a zero divisor. GCD and LCM normalize signs. LCM divides by the GCD before multiplying to limit intermediate size. No conversion to Number occurs. Computation cost and maximum size remain subject to the JavaScript engine's BigInt resources.

```ts
import { gcdBigInt, lcmBigInt, divFloorBigInt, divCeilBigInt, moduloBigInt }
    from '@neutrium/utilities/integer';

gcdBigInt(-18n, 24n);       // 6n
lcmBigInt(18n, 24n);        // 72n
divFloorBigInt(-7n, 3n);    // -3n
divCeilBigInt(-7n, 3n);     // -2n
moduloBigInt(-7n, 3n);      // 2n
moduloBigInt(-7n, -3n);     // 2n
```

Native BigInt `/` truncates toward zero, and native `%` returns a remainder with the dividend's sign. Use those operators directly when those semantics are desired. Euclidean modulo with a negative divisor is not the remainder associated with floor division: each helper's rounding/sign contract is independent.

These helpers can replace quantity's duplicate GCD functions and its inline LCM calculation. Quantity-specific rational arithmetic, decimal rounding and unit rules remain in quantity. Other packages have not been migrated as part of this addition.

Runtime tests and TypeScript consumer tests live in `src/integer/tests` and run with `pnpm run verify`. They cover signed boundaries, large exact values, zero/error contracts and small-domain comparisons against independent reference calculations.

## Fixed-width words

```ts
import { rotateLeft32, rotateRight32, splitUint64, joinUint64 } from '@neutrium/utilities/integer';

rotateLeft32(0x80000001, 1); // 3
rotateRight32(3, 1); // 0x80000001
const [low, high] = splitUint64(0x123456789abcdef0n);
joinUint64(low, high); // 0x123456789abcdef0n
```

Rotations require unsigned 32-bit number inputs. Shift counts must be signed safe integers and are normalized modulo 32; negative counts rotate in the opposite direction. Results are unsigned numbers, with zero normalized to +0.

`splitUint64` accepts a bigint in [0, 2^64 - 1] and returns a readonly-typed tuple in **low-word, high-word** order. `joinUint64(low, high)` takes two unsigned 32-bit numbers and returns an exact bigint. Word ordering is independent of machine byte endianness. No helper coerces inputs or silently truncates out-of-range values. Invalid number words and shifts throw RangeError. Split rejects non-bigint inputs with TypeError and out-of-range bigints with RangeError. Number word inputs accept -0 as zero.
