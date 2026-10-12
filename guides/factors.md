---
title: Integer factor products
---

# Integer factor products

Import the helpers from `@neutrium/utilities/numeric/factors`, `/numeric`, or the package root. The dedicated subpath imports no numeric adapters or Decimal runtime.

`Factors` is a mutable `Map<bigint, bigint>` of positive integer bases to signed powers. Negative powers represent division. Zero and negative bases are rejected; carry the overall sign separately. These helpers cancel common divisors rather than performing prime factorization.

```ts
import { addFactor, reduceFactors, factorRatio, factoredValue } from '@neutrium/utilities/numeric/factors';

const factors = new Map<bigint, bigint>();
addFactor(factors, 1000n, 1n);
addFactor(factors, 3600n, -1n);
reduceFactors(factors);
factorRatio(factors); // [5n, 18n]
```

- `addFactor(factors, base, exponent)` accumulates powers in place, ignoring identity factors and removing powers that cancel to zero.
- `reduceFactors(factors)` cancels numerator and denominator bases without expanding their powers. It normalizes identity factors, mutates the map and returns that same map.
- `factorRatio(factors, maxDigits = 4096)` returns an exact `[numerator, denominator]` when expansion fits its conservative budget, or `undefined` otherwise. It does not reduce or mutate the map. The estimate sums each base's decimal digit count multiplied by its absolute power; it is not a heap-memory guarantee. Empty products return `[1n, 1n]` even at budget zero.
- `factoredValue(factors, negative = false, maxDigits = 4096)` copies and reduces the map, separates powers of ten, then returns either `{ exact }` or `{ bounds(precision) }`. Later mutations to the input cannot affect a prepared value. Set the budget to zero to request bounds for remaining nontrivial factors.

`RationalTerm` represents `numerator / denominator * 10 ** exponent` with BigInt fields and a positive denominator. Keeping the decimal exponent separate avoids allocating enormous powers of ten. `RationalValue` is either an exact term or ordered lower/upper terms produced at a requested positive safe-integer decimal working precision. Bounds are directed enclosures, not a final rounded scalar or a promise of a particular relative error.

The consumer decides how to refine bounds, round the final result, enforce backend ranges and cache prepared values. These helpers neither convert live scalars nor impose a Decimal configuration. Native-number consumers can prepare catalog factors once and continue using ordinary adapter arithmetic.
