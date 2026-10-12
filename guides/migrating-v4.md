---
title: Migrating to Version 4
---

# Migrating to version 4

Utilities 4.0.0 changes the public numeric adapter contract and removes native adapter singletons, Decimal factories and Decimal singletons. Upgrade consumers explicitly to `@neutrium/utilities@^4.0.0`. Node.js 24 or later is required. Decimal users also need the optional peer `@neutrium/decimal@^2.3.0`; other backends do not load or require Decimal.

## Construct native adapters

Before (3.x):

```ts
import { numberAdapter } from '@neutrium/utilities/number';
// The /numeric entry also exported numberAdapter and its doubleAdapter alias.
numberAdapter.add(1, 2);
```

After:

```ts
import { NumberAdapter } from '@neutrium/utilities/number';
const numeric = new NumberAdapter();
numeric.add(1, 2);
```

`NumberAdapter` is also exported from `/numeric`. Replace `BinaryAdapter` type imports with `NumberAdapter` when the native implementation matters, or an appropriate generic adapter interface when it does not. `BinaryConfig` is removed; Number no longer has `config`, `identity`, or configurable precision. Methods live on the prototype, so object spread does not copy an adapter's methods. Extend the class to customize it. Native Number methods still support detached calls. Use `Object.freeze(new NumberAdapter())` if you need a frozen instance like the old singleton.

Number methods now trust their typed operands instead of checking their runtime types on every call. Use `from` to convert external values or `isValue` to validate them at the boundary. JavaScript consumers must not rely on arithmetic or `toBytes` throwing for non-number operands. Literal parsing in `from` and `pow`, and integer-exponent validation in `powInteger`, remain in place.

`BigIntAdapter` follows the same policy for typed BigInt operands. Its conversion boundary still rejects unsafe Numbers and fractional values, and integer powers still reject negative or noninteger exponents. BigInt byte sizing uses hexadecimal digit counts with the same minimum-one-byte results.

## Choose float32 behavior explicitly

The `/float` entry and `floatAdapter` are removed. `NumberAdapter` uses JavaScript binary64 arithmetic; replacing the float32 adapter with it changes precision, range, rounding, overflow and underflow. For example, adding 1 to 16777216 previously rounded to 16777216 with float32, but yields 16777217 with `NumberAdapter`.

If binary32 behavior is required, provide a custom adapter that consistently applies float32 quantization to construction, operands and operation results. Applying `Math.fround` only to the final result does not reproduce rounding at each intermediate operation. Use a Decimal adapter when decimal precision and rounding are required.

## Construct Decimal adapters and bind callbacks

The `createDecimalAdapter` factory and `DecimalAdapter` singleton exports are removed from all Decimal entry points. Construct `DecimalCoreAdapter`, `DecimalArithmeticAdapter`, or `DecimalScientificAdapter` from the matching tier path instead. The `/decimal` entry exports `DecimalScientificAdapter`. Constructor-created instances are extensible; their configuration and returned scalars remain immutable. Use `Object.freeze(new DecimalArithmeticAdapter(options))` if you also need a frozen adapter instance. `withConfig` continues to return an independent frozen instance.

Before, factory methods were closures and could be detached:

```ts
import { createDecimalAdapter } from '@neutrium/utilities/decimal/arithmetic';
const numeric = createDecimalAdapter({ precision: 40 });
const parse = numeric.from;
const values = ['0.1', '0.2'].map(parse);
```

After, bind the receiver or call through it:

```ts
import { DecimalArithmeticAdapter } from '@neutrium/utilities/decimal/arithmetic';
const numeric = new DecimalArithmeticAdapter({ precision: 40 });
const parse = numeric.from.bind(numeric);
const values = ['0.1', '0.2'].map(parse);
const higherPrecision = numeric.withConfig({ precision: 60 });
```

Use inheritance instead of spreading a Decimal adapter to extend it. `withConfig` creates the concrete tier class; it does not preserve a custom subclass. Core and arithmetic imports continue to exclude higher-tier implementations.

The built-in classes now also inherit from one another: scientific extends arithmetic, which extends core. `instanceof` therefore recognises the lower-tier base classes. Inherited operations retain the scalar type and configuration of the selected tier. Constructors accept the same configuration options as the removed factories.

## Update custom adapters

Previously, every `NumericAdapter<T>` exposed `identity` and `config`. Those properties are no longer part of the generic contract. Consumers must choose their own compatibility and cache-scoping rules; equal `id` strings do not establish compatibility. Configurable implementations can expose `config` and `withConfig`; use `isConfigurableAdapter` and `NumericOptions` from `/numeric/helpers` when working with that optional capability.

Every core adapter must now implement `toBytes(value)`. Every arithmetic or scientific adapter must also implement `powInteger(value, exponent)`. For a custom Number representation, the added methods can look like this:

```ts
import type { ArithmeticAdapter } from '@neutrium/utilities/numeric';
import { assertInteger } from '@neutrium/utilities/validation';

const addedMethods: Pick<ArithmeticAdapter<number>, 'toBytes' | 'powInteger'> = {
    toBytes(value) {
        return 8;
    },
    powInteger(value, exponent) {
        assertInteger(exponent, 'exponent');
        return value ** exponent;
    },
};
```

Add these methods to the existing implementation alongside its other required operations; the example is not a complete adapter. Adapt their implementation to the backend rather than converting custom scalars to Number. `powInteger` receives the original integer Number exponent, avoiding rounding the exponent through the scalar representation. Reject fractional and nonfinite exponents. Decimal additionally requires a safe integer; BigInt rejects negative powers.

`toBytes` describes scalar storage size or a documented estimate, not total retained heap size. Cache owners remain responsible for keys, per-entry overhead and retention policies. Number reports 8 bytes; Decimal delegates to its stored-state estimate. Use `toBytes` instead of the provisional `estimateBytes`/`estimateScalarBytes` APIs, and `powInteger` instead of the provisional `adapterPower` helper.

## Optional exact rational operations

`RationalArithmeticAdapter<T>` and `hasRationalArithmetic` are exported from `/numeric/rational`, `/numeric` and the package root. They describe and detect `toRationalTerm`, `fromRationalSum` and `compareRationalSum`. Decimal arithmetic and scientific adapters provide these methods; custom adapters do not need to implement them to satisfy `ArithmeticAdapter<T>`.

Native Number operations keep their native representation. The rational helpers do not introduce a Decimal dependency into native or generic imports. See [Numeric Adapters](numeric%20adapters.md) for the complete contracts and [Integer Factors](factors.md) for factor preparation.
