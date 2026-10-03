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
