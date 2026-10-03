---
title: Numeric Adapters
---

# Numeric Adapters

Write a numerical algorithm once, then supply its scalar representation and arithmetic context. The framework supports custom backends and ships concrete JavaScript Number (binary64), float32 and Neutrium Decimal implementations.

## Capability tiers and imports

| Tier | Interface | Operations |
| --- | --- | --- |
| Core | `NumericAdapter<T>` | Construction, native-value recognition, comparison, finite/NaN/integer predicates, number/text conversion. |
| Arithmetic | `ArithmeticAdapter<T>` | Core plus add/subtract/multiply/divide, remainder, negation, absolute value and integer rounding. |
| Scientific | `ScientificAdapter<T>` | Arithmetic plus powers, roots, exponentials, logarithms, circular/hyperbolic trigonometry, pi and atan2. |

Import contracts as types from `@neutrium/utilities/numeric` or the package root. `numeric/core`, `numeric/arithmetic` and `numeric/scientific` also expose the individual contracts. These three type-only entries have no runtime backend dependency. The main numeric entry also exports `floatAdapter`, `numberAdapter` and `doubleAdapter` (the same instance as `numberAdapter`). These are the same singleton instances exported by `float` and `number`, so importing through different entry points preserves backend and configuration identity.

Number and float32 each expose one complete adapter. Decimal retains separate runtime tiers because its higher tiers contain substantial numerical implementations.

| Backend | Import suffix | Capabilities |
| --- | --- | --- |
| Number | `number` | Complete scientific adapter |
| Float32 | `float` | Complete scientific adapter |
| Decimal | `decimal/core` | Core |
| Decimal | `decimal/arithmetic` | Arithmetic |
| Decimal | `decimal/scientific` or `decimal` | Scientific |

Prefix these paths with `@neutrium/utilities/`. Named singleton exports are `numberAdapter`, `floatAdapter` and `DecimalAdapter`, respectively. Every Decimal entry also exports `createDecimalAdapter(options?)`. Its options and output values use the matching Decimal tier. Decimal core has no arithmetic methods; Decimal arithmetic has no scientific methods, both at runtime and in declarations.

The native adapters share a single `BinaryAdapter` implementation contract extending `ScientificAdapter<number>`. Both native entries export `BinaryAdapter` and `BinaryConfig` as types. Their `tier` is always `scientific`; the three framework interfaces remain available so algorithms can require only the capabilities they use.

Native Math operations already exist in the runtime. Separate native tiers would save only wrapper code, so they have been removed. Importing one native adapter still does not initialize the other. Tree shaking can remove unused modules, but individual methods on an imported complete adapter object are not promised to be removed.

```ts
import type { ArithmeticAdapter } from '@neutrium/utilities/numeric';
import { numberAdapter } from '@neutrium/utilities/number';
import { floatAdapter } from '@neutrium/utilities/float';
import { createDecimalAdapter } from '@neutrium/utilities/decimal/arithmetic';

function mean<T>(numeric: ArithmeticAdapter<T>, a: T, b: T): T
{
    return numeric.div(numeric.add(a, b), numeric.from(2));
}

mean(numberAdapter, 0.1, 0.2);
mean(floatAdapter, floatAdapter.from('0.1'), floatAdapter.from('0.2'));
const decimal = createDecimalAdapter({ precision: 40, rounding: 'half-even' });
decimal.toString(mean(decimal, decimal.from('0.1'), decimal.from('0.2'))); // '0.15'
```

## Decimal adapters

There is also an adapter to use the [@neutrium/decimal](https://github.com/neutrium/decimal) in place of native number representation.

## Number and float32 semantics

Number uses native IEEE-754 binary64 arithmetic. Float32 uses JavaScript numbers as containers and `Math.fround` to normalize inputs and operation outputs. It therefore models binary32 value boundaries, not a four-byte JavaScript object allocation. Native settings are fixed; these adapters have no `withConfig` method.

Float32 transcendental functions use native double-precision `Math` evaluations, then round the final result to float32. Logarithms to a base evaluate both logs and their quotient in double precision before the final rounding. Numeric strings first parse to Number, then round to float32. This can exhibit double rounding; it does not promise a correctly rounded direct decimal-to-binary32 parser, a particular hardware libm implementation, fused operations or bitwise agreement with a GPU.

`floatAdapter.isValue` recognizes numbers already representable in float32, including NaN, infinities and signed zero. Its operations accept Number operands and normalize them to float32. Both native adapters use `number` as the TypeScript scalar type; applications must check adapter identity when exchanging higher-level objects.

## Shared value contract

- Methods never mutate operands. Custom adapters must also expose immutable scalars.
- `from` accepts native scalars, Number, BigInt, or trimmed decimal text with an optional sign, fractional part and exponent. The special strings `NaN`, `Infinity`, `+Infinity` and `-Infinity` are accepted. Empty strings, prefixed literals such as `0xff`, booleans and arbitrary stringifiable objects are rejected. Native Decimal instances are recognized across its installed tiers; another installed copy is not automatically compatible.
- Conversion into Number/float may lose precision, overflow or underflow. `toNumber` is always explicitly potentially lossy. Use string literals for exact Decimal input instead of already-rounded Number values.
- `toString` preserves negative zero and uses backend formatting. Decimal output limits still apply. It is a numeric serialization operation, not localization.
- `compare` returns a negative value, zero, a positive value or NaN for unordered comparisons. Positive and negative zero compare equal.
- Arithmetic operands must be native backend values. Use `from` explicitly to convert scalars across different backend identities. Generic library classes should reject mixed identities before dispatching operations.
- `round` follows backend policy: Number/float use `Math.round` (ties toward positive infinity), while Decimal uses its configured rounding mode. `rem` follows native `%` or Decimal's configured modulo mode; it is not always Euclidean modulo.
- Division by zero, invalid real domains, NaN, infinity and signed zero follow the underlying backend. Number and float allow the usual IEEE-754 results; Decimal also enforces its precision and resource limits.
- Scientific `pow` accepts the original exponent literal without an intermediate Number conversion in the framework. The backend interprets it; unit-exponent restrictions remain in quantity.

## Custom backends and migration

Implement the smallest interface required by a consumer. Custom fixed-point or rational libraries can implement `ArithmeticAdapter<T>` without implementing trigonometry. Define a stable object `identity` for compatible representations and immutable `config` snapshots. The `tier` discriminant identifies the advertised
contract; there is no expensive runtime inspection or global registration.