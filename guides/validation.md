---
title: Validation guide
---

# Validation

Import individual functions from `@neutrium/utilities/validation` or the package root. All value arguments accept `unknown`; there is no string conversion, truncation, mutation, or numeric coercion. Guards return booleans and narrow types. Assertions return `void` on success, narrow types, and throw on failure. Their optional `name` argument labels errors without formatting the rejected value.

| Guards | Assertions | Contract |
| --- | --- | --- |
| Native `typeof` checks | `assertString`, `assertBoolean`, `assertBigInt` | Primitive values only; boxed objects fail. |
| Native `Number.isFinite` | `assertFiniteNumber` | Excludes NaN and infinities. |
| Native `Number.isInteger` | `assertInteger` | Integer-valued number; may be outside safe integer limits. |
| Native `Number.isSafeInteger` | `assertSafeInteger` | Integer within ±Number.MAX_SAFE_INTEGER. |
| `isNonNegativeSafeInteger` | `assertNonNegativeSafeInteger` | Safe integer ≥ 0; accepts -0. |
| `isPositiveSafeInteger` | `assertPositiveSafeInteger` | Safe integer > 0. |
| `isUint32` | `assertUint32` | Integer from 0 through 2³² − 1; accepts -0. |
| `isInRange(value, min, max)` | `assertInRange(value, min, max, name?)` | Finite inclusive range; fractions allowed. |
| Native null/undefined checks | `assertDefined` | Excludes only null and undefined. |
| `isPlainRecord` | `assertPlainRecord` | Local Object.prototype or null prototype; no field validation. |
| Native `choices.includes(value)` | `assertOneOf(value, choices, name?)` | SameValueZero membership, retaining literal-union types. |
| — | `assertKnownKeys(value, keys, name?)` | Plain record with only allowed own keys. |

Numeric and choice assertions throw `RangeError`, even when a numeric input has the wrong primitive type. Other assertions throw `TypeError`. This matches cache limit validation. Use compound guards or native checks when consumers need custom errors. Assertions remain useful because they throw named errors and narrow unknown inputs; built-in predicate functions do not provide that assertion contract.

Range bounds must be finite and ordered: invalid bounds make `isInRange` return false and `assertInRange` throw. Combine `assertSafeInteger` and `assertInRange` when an integer and a narrower range are both required.

```ts
import { assertKnownKeys, assertPositiveSafeInteger, assertOneOf } from '@neutrium/utilities/validation';

function configure(input: unknown)
{
    assertKnownKeys(input, ['precision', 'mode'], 'configuration');
    const precision = input.precision;
    const mode = input.mode;
    assertPositiveSafeInteger(precision, 'precision');
    assertOneOf(mode, ['fast', 'precise'], 'mode');
    return { precision, mode }; // number and 'fast' | 'precise'
}

Number.isFinite('12'); // false
Number.isFinite(Infinity); // false
```

`assertKnownKeys` checks all own keys, including non-enumerable and symbol keys. It does not require any allowed key to exist or inspect values. Use string keys for numeric property names (`'0'`, not `0`), matching JavaScript reflection. Getter properties are not invoked. Proxies may execute reflection traps; errors from enumerating their keys propagate.

`isPlainRecord` deliberately excludes class instances, arrays and objects with a foreign realm's Object.prototype. It is a shallow structural check, not a guarantee of accessor-free or immutable data. A failing prototype reflection trap returns false. Choices use object identity, match NaN with NaN, and treat -0 and +0 alike. Pass dense readonly tuples for choice lists; no deep comparison is performed.

## Typed-array guards

`isFloat32Array`, `isFloat64Array`, `isUint8Array` and `isUint32Array` narrow unknown values to the corresponding typed-array type. They use the intrinsic typed-array brand, so they accept foreign-realm arrays, subclasses and shared-buffer views. Uint8Array subclasses such as Node buffers are accepted; Uint8ClampedArray and DataView are not.

Own `Symbol.toStringTag` properties cannot spoof the checks and their getters are not invoked. Proxies, including revoked proxies, return false. These guards check the type, not whether the backing buffer remains usable: detached views still match their brand.
