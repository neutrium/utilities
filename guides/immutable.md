---
title: Immutable guide
---

# Immutable data snapshots

```ts
import { immutableSnapshot, isImmutableSnapshot } from '@neutrium/utilities/immutable';

const input = { limits: { entries: 100 }, labels: ['primary'] };
const snapshot = immutableSnapshot(input);
input.limits.entries = 200; // snapshot.limits.entries remains 100
isImmutableSnapshot(snapshot); // true
```

`immutableSnapshot<T>` returns `DeepReadonly<T>`. It copies and recursively freezes local plain records, null-prototype records and arrays. Primitive values pass through, including symbols, bigint, undefined, NaN and signed zero. Functions, accessors, class instances, foreign-realm containers, typed arrays, Map, Set and Date are rejected with TypeError. Runtime input validation still applies even when TypeScript accepts a value.

Copies preserve cycles, shared references, array holes, symbol and nonenumerable properties, and record prototypes. All copied properties become nonwritable and nonconfigurable. Each call creates a fresh graph without mutating or retaining input objects. Iterative traversal supports deeply nested graphs without recursive stack growth.

Accessors are rejected without invocation. Proxies cannot be reliably identified; reflection traps may run, and their failures propagate. This API is for data graphs, not isolation from hostile code or a generic object serialization format.

`isImmutableSnapshot` recognizes objects created by successful calls in this module instance, including nested objects. It returns false for primitives and arbitrary frozen objects. Branding supports identity caches; it does not imply structural equality.

## Root overrides

Pass a second plain record to bind root properties before freezing:

```ts
const source: { locale?: string; nested: { locale?: string }; self?: unknown } = { nested: {} };
source.self = source;
const snapshot = immutableSnapshot(source, { locale: 'en-US' });
snapshot.locale; // 'en-US'
snapshot.self === snapshot; // true
snapshot.nested.locale; // undefined: only the root is changed
```

The result type replaces the overridden root keys and makes the resulting graph deeply readonly. Overrides are explicit replacements, including `undefined`; they do not merge nested objects or infer defaults. A replacement value that references the input root points to the snapshot root. Shared references between the source and override values remain shared in the copy.

The override record must be a local plain or null-prototype record. Roots may also be local arrays, but overriding an array's `length` or indexed elements is rejected; named and symbol properties can be overridden without affecting sparse elements. Existing root properties preserve their original enumerability, including hidden properties. New properties use the override record's enumerability. Symbols and an own `__proto__` data property are supported. Neither input is mutated, even if already frozen. Root accessors and override accessors are rejected without invocation, including root accessors whose keys are overridden. Replaced values are not traversed; all retained and replacement values must satisfy the usual snapshot rules. Proxy reflection errors propagate unchanged.
