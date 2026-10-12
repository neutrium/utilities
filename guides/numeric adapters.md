---
title: Numeric Adapters
---

# Numeric Adapters

Write a numerical algorithm once, then supply its scalar representation and arithmetic context. The framework supports custom backends and ships concrete JavaScript Number (binary64), BigInt and Neutrium Decimal implementations. For changes from 3.x, see [Migrating to version 4](migrating-v4.md).

## Capability tiers and imports

| Tier | Interface | Operations |
| --- | --- | --- |
| Core | `NumericAdapter<T>` | Construction, native-value recognition, comparison, finite/NaN/integer predicates, number/text conversion and scalar byte size. |
| Arithmetic | `ArithmeticAdapter<T>` | Core plus integer powers, add/subtract/multiply/divide, remainder, negation, absolute value and integer rounding. |
| Scientific | `ScientificAdapter<T>` | Arithmetic plus powers, roots, exponentials, logarithms, circular/hyperbolic trigonometry, pi and atan2. |

Import contracts as types from `@neutrium/utilities/numeric` or the package root. `numeric/core`, `numeric/arithmetic` and `numeric/scientific` also expose the individual contracts. These three type-only entries have no runtime backend dependency. The main numeric entry exports the same `NumberAdapter` class as `@neutrium/utilities/number`.

Number exposes one complete adapter. Decimal retains separate runtime tiers because its higher tiers contain substantial numerical implementations.

| Backend | Import suffix | Capabilities |
| --- | --- | --- |
| Number | `number` | Complete scientific adapter |
| BigInt | `bigint` | Integer arithmetic adapter |
| Decimal | `decimal/core` | Core |
| Decimal | `decimal/arithmetic` | Arithmetic |
| Decimal | `decimal/scientific` or `decimal` | Scientific |

Prefix these paths with `@neutrium/utilities/`. Construct Number with `new NumberAdapter()` and Decimal with `new DecimalCoreAdapter(options?)`, `new DecimalArithmeticAdapter(options?)`, or `new DecimalScientificAdapter(options?)` from the matching entry. The `decimal` entry exports `DecimalScientificAdapter`. Decimal options and output values use the matching tier. Decimal core has no arithmetic methods; Decimal arithmetic has no scientific methods, both at runtime and in declarations.

Decimal constructors create extensible instances with immutable configuration and returned scalars. Use `Object.freeze(new DecimalArithmeticAdapter(options))` if you also need a frozen adapter instance. `withConfig(options)` returns an independent frozen instance of the concrete tier class. Decimal factories and singleton exports are no longer available.

The `NumberAdapter` class implements `ScientificAdapter<number>`. Both the `number` and `numeric` entries export the class. Use `new NumberAdapter()` to construct an instance or extend the class for a custom implementation. Methods do not depend on `this`, so they can be passed as callbacks. Methods live on the prototype; use class inheritance rather than object spread to extend the adapter. Its `tier` is always `scientific`; algorithms can require only the framework capabilities they use.

Native Math operations already exist in the runtime, so Number exposes one complete adapter. Tree shaking can remove unused modules, but individual methods on an imported adapter object are not promised to be removed.

```ts
import type { ArithmeticAdapter } from '@neutrium/utilities/numeric';
import { NumberAdapter } from '@neutrium/utilities/number';
const numberAdapter = new NumberAdapter();
import { DecimalArithmeticAdapter } from '@neutrium/utilities/decimal/arithmetic';

function mean<T>(numeric: ArithmeticAdapter<T>, a: T, b: T): T
{
    return numeric.div(numeric.add(a, b), numeric.from(2));
}

mean(numberAdapter, 0.1, 0.2);
const decimal = new DecimalArithmeticAdapter({ precision: 40, rounding: 'half-even' });
decimal.toString(mean(decimal, decimal.from('0.1'), decimal.from('0.2'))); // '0.15'
```

## Decimal adapters

There is also an adapter to use the [@neutrium/decimal](https://github.com/neutrium/decimal) in place of native number representation.

## Number semantics

`NumberAdapter` uses JavaScript's native IEEE-754 binary64 arithmetic and `Math` functions. Settings are fixed; it has no `withConfig` method. `isValue` recognizes JavaScript numbers, including NaN, infinities and signed zero. Methods with `number` operands use them directly without runtime type checks. Convert external inputs with `from`, or validate them with `isValue`, before calling these methods. Passing other types violates the contract and may trigger JavaScript coercion rather than an error.

`toBytes(value)` returns 8 for a Number operand, including NaN, infinities and signed zero, without inspecting the value. This describes the scalar representation, not total JavaScript heap usage.

There is no built-in float32 adapter. Choosing `new NumberAdapter()` uses binary64 throughout; see the [migration guide](migrating-v4.md) for the resulting precision and range changes.

## Shared value contract

- Methods never mutate operands. Custom adapters must also expose immutable scalars.
- `from` accepts native scalars, Number, BigInt, or trimmed decimal text with an optional sign, fractional part and exponent. The special strings `NaN`, `Infinity`, `+Infinity` and `-Infinity` are accepted. Empty strings, prefixed literals such as `0xff`, booleans and arbitrary stringifiable objects are rejected. Native Decimal instances are recognized across its installed tiers; another installed copy is not automatically compatible.
- Conversion into Number may lose precision, overflow or underflow. `toNumber` is always explicitly potentially lossy. Use string literals for exact Decimal input instead of already-rounded Number values.
- `toString` preserves negative zero and uses backend formatting. Decimal output limits still apply. It is a numeric serialization operation, not localization.
- `compare` returns a negative value, zero, a positive value or NaN for unordered comparisons. Positive and negative zero compare equal.
- Arithmetic operands must be native backend values. Use `from` explicitly to convert scalars across different representations. Generic library classes should apply their own compatibility checks before dispatching operations.
- `round` follows backend policy: Number uses `Math.round` (ties toward positive infinity), while Decimal uses its configured rounding mode. `rem` follows native `%` or Decimal's configured modulo mode; it is not always Euclidean modulo.
- Division by zero, invalid real domains, NaN, infinity and signed zero follow the underlying backend. Number allows the usual IEEE-754 results; Decimal also enforces its precision and resource limits.
- Scientific `pow` accepts the original exponent literal without an intermediate Number conversion in the framework. The backend interprets it; unit-exponent restrictions remain in quantity.

## Custom backends

Implement the smallest interface required by a consumer. Custom fixed-point or rational libraries can implement `ArithmeticAdapter<T>` without implementing trigonometry. Use `id` for diagnostics only. Consumers own representation-compatibility policies; matching `id` labels do not establish compatibility. Only configurable backends expose numerical settings: Decimal retains `config` and `withConfig` for precision, rounding and range. The `tier` discriminant identifies the advertised contract; there is no expensive runtime inspection or global registration.

## Generic adapter helpers

Import reusable operations from `@neutrium/utilities/numeric/helpers`. They are also exported by `/numeric` and the package root. The helpers subpath imports no backend, so it does not pull Decimal or the native adapter into a bundle.

```ts
import { toSafeInteger, isConfigurableAdapter } from '@neutrium/utilities/numeric/helpers';
import { NumberAdapter } from '@neutrium/utilities/number';
const numberAdapter = new NumberAdapter();

numberAdapter.powInteger(2, -3); // 0.125
toSafeInteger('12e2'); // 1200
isConfigurableAdapter(numberAdapter); // false
```

`toSafeInteger(value, adapter?)` validates decimal literals before converting them, so a tiny fraction cannot underflow to zero and a long fraction cannot round into an integer. For custom scalar objects, pass the adapter; conversion uses `isInteger` and `toNumber` without formatting. `IntegerConversionError.reason` distinguishes `invalid`, `fractional` and `range` failures so consuming libraries can provide their own diagnostics.

`NumericOptions<A>` infers an adapter's configuration options or produces `never` for fixed adapters. `ConfigurableAdapter<A, Options>` explicitly describes the returned adapter type and accepted options, while `isConfigurableAdapter` detects a callable `withConfig` at runtime. The guard preserves known signatures but cannot recover options or return types erased to a generic numeric interface. Generic consumers that configure adapters should declare a `ConfigurableAdapter` contract; a presence check alone does not make arbitrary options safe or guarantee a returned subclass. Decimal's inherited `withConfig` returns the base tier class.

## BigInt adapter

```ts
import { BigIntAdapter } from '@neutrium/utilities/bigint';

const integer = new BigIntAdapter();
integer.add(integer.from('9007199254740993'), 1n); // 9007199254740994n
integer.div(-7n, 3n); // -2n: truncates toward zero
integer.powInteger(2n, 100); // exact integer power
```

`BigIntAdapter` is also exported from `/numeric`. It implements `ArithmeticAdapter<bigint>` with no configuration. Methods support detached calls. It does not expose scientific operations or a default singleton.

Methods with `bigint` operands use them directly without runtime type checks, matching Number's typed-input policy. Use `from` to convert external inputs or `isValue` to validate them first. Passing other types violates the contract; native JavaScript behaviour determines whether an error occurs. Integer-exponent validation remains in place.

`from` accepts native BigInt, safe integer Number values, and exact integer-valued decimal strings, including decimal points and exponent notation (`'1.20e2'` becomes `120n`). Unsafe Numbers are rejected: supply text or BigInt to preserve large integers. Malformed inputs, prefixed literals and arbitrary objects throw `TypeError`; fractional or nonfinite inputs throw `RangeError`. Conversion never rounds a fraction into an integer.

Division truncates toward zero; remainder has the dividend's sign. Zero divisors and negative powers throw `RangeError`. `powInteger` requires a nonnegative finite integer Number exponent. Zero to the zeroth power is `1n`. Rounding operations return the input unchanged. BigInt has no NaN, infinity or negative zero; arithmetic operands must be BigInt values. Very large values and powers remain subject to the JavaScript engine's resource limits.

`toNumber` may lose precision or overflow. `toString` returns exact decimal text. `toBytes` reports the minimum unsigned magnitude width (at least one byte for zero), excluding the sign and engine allocation overhead; it is not a JavaScript heap-size measurement.

Byte sizing counts hexadecimal digits, with two digits per byte, to avoid allocating a longer binary string. Results are identical at byte boundaries and for either sign.

## Decimal adapter classes

The classes form an inheritance hierarchy: `DecimalArithmeticAdapter` extends `DecimalCoreAdapter`, and `DecimalScientificAdapter` extends `DecimalArithmeticAdapter`. Core operations and arithmetic methods are implemented once. Each instance has one isolated context for its selected tier, so inherited operations still return that tier's scalar type. A scientific adapter's `add`, for example, returns a scientific Decimal.

```ts
import { DecimalArithmeticAdapter } from '@neutrium/utilities/decimal/arithmetic';

const numeric = new DecimalArithmeticAdapter({ precision: 40, rounding: 'half-even' });
const result = numeric.add(numeric.from('0.1'), numeric.from('0.2'));
numeric.toString(result); // '0.3'
const higherPrecision = numeric.withConfig({ precision: 60 });
```

Constructors capture current tier defaults into an isolated context. `config` is a readonly getter returning frozen settings. `withConfig` creates an independent instance of the same tier, retaining unchanged settings. Returned scalars stay frozen. Classes can be extended; `withConfig` returns the concrete tier class rather than preserving custom subclasses.

Derived implementations can use the protected, frozen `context`. Core and arithmetic classes carry constructor and tier type parameters for this inheritance; ordinary callers can omit them. A specialization must supply its matching Decimal constructor and tier after the configuration argument rather than relying on the base defaults.

Decimal adapters require the optional peer `@neutrium/decimal@^2.3.0`. `toBytes(value)` delegates to Decimal's native stored-state estimate: eight-byte slots for the coefficient reference, exponent, sign, and each stored base-1e7 coefficient word. This replaces the previous 128-byte overhead heuristic. A one-word finite value reports 32 bytes; NaN and infinities report 24. It does not serialize the value or approximate the stored coefficient length using significant digits. Engine-dependent object/array headers, alignment, private-field metadata and shared prototypes are excluded; it is not an actual heap measurement. Cache overhead and admission policies remain consumer concerns.


## Backend-independent rational helpers

Import `parseRationalTerm`, `scaleTerm`, `negateValue`, `evaluateRational`, and `hasRationalArithmetic` from `@neutrium/utilities/numeric/rational`. The same exports are available from `/numeric` and the package root, without loading Decimal. `RationalTerm` and `RationalValue` retain their existing type exports from `/numeric/factors` as well.

```ts
import { parseRationalTerm, scaleTerm, negateValue, evaluateRational } from '@neutrium/utilities/numeric/rational';
const term = parseRationalTerm('2.5'); // 25n / 1n * 10n ** -1n
const scaled = scaleTerm(term, 3n, 2n); // 75n / 2n * 10n ** -1n = 3.75
const negative = negateValue({ exact: scaled });
const result = evaluateRational([negative], terms => terms[0].numerator); // -75n
```

Parsing accepts only finite decimal strings, without whitespace or implicit coercion. Components remain BigInts, including arbitrarily large decimal exponents, without exponent expansion or rounding. Negative zero has numerator zero; trailing zeros and common factors are not normalized. `scaleTerm` requires a positive input denominator and a nonzero scaling denominator, moving any negative scaling sign to the numerator. Helpers do not mutate their inputs. `negateValue` reverses and negates enclosure endpoints lazily.

`evaluateRational(values, evaluate, { initialPrecision, maxPrecision, equal })` calls the evaluator once for exact inputs. Otherwise it doubles precision from 64 up to 1,000,000 by default, evaluates both endpoints, and returns when they agree. Both precision settings must be positive safe integers, with the initial value no greater than the maximum. The maximum is evaluated before a nonconvergent result throws `RangeError`. The default equality is `Object.is`, including signed-zero distinctions; supply `equal` for backend object values. Callback exceptions propagate. Bounds must enclose the value in lower/upper order, and the evaluator must be monotone in the same direction in every operand; negate subtrahends first. The helper does not prove these mathematical preconditions.

`RationalArithmeticAdapter<T>` adds exact extraction, final rational-sum construction, and exact sign comparison to `ArithmeticAdapter<T>`. Utilities' Decimal arithmetic and scientific classes implement it. `hasRationalArithmetic(adapter)` checks the additional methods, including prototype methods, and narrows the type. It does not validate the base arithmetic contract. Native Number and other backends remain free to implement only ordinary arithmetic. Cache ownership, unit conversion and temperature rules stay with consumers.
