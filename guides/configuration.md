---
title: Configuration guide
---

# Configuration

Import `mergeDefined`, `resolveConfig` and the `ConfigurationValidator<T>` type from `@neutrium/utilities/configuration` or the root export. These helpers add defined-only updates, strict option checking and validated snapshots to native object operations. There is no schema framework, global configuration, deep merge or compatibility layer.

## Typed updates

`mergeDefined(defaults, ...updates)` returns a new mutable object of the defaults' TypeScript type. Updates must be partial values of that type. Later defined values win; undefined inherits the previous value. Null, false, zero and empty strings are explicit replacements. This function does not validate field values at runtime; use `resolveConfig` at untrusted boundaries.

```ts
import { mergeDefined } from '@neutrium/utilities/configuration';

const config = mergeDefined({ precision: 20, enabled: true },
    { precision: undefined }, { enabled: false });
// { precision: 20, enabled: false }
```

## Validated snapshots

`resolveConfig(defaults, input, validate, name?)` accepts unknown input, merges it, shallow-freezes the result, and calls an assertion function on the complete result. The assertion must validate every field and any relationships between them. Its errors propagate unchanged. Undefined input means no update. Invalid defaults are also checked, even when no update is supplied. The optional name labels structural errors and defaults to `configuration`.

```ts
import { resolveConfig } from '@neutrium/utilities/configuration';
import { assertKnownKeys, assertPositiveSafeInteger, assertOneOf }
    from '@neutrium/utilities/validation';

interface Config { precision: number; mode: 'fast' | 'precise' }
const defaults: Config = { precision: 20, mode: 'fast' };

function validate(value: unknown): asserts value is Config
{
    assertKnownKeys(value, ['precision', 'mode']);
    assertPositiveSafeInteger(value.precision, 'precision');
    assertOneOf(value.mode, ['fast', 'precise'], 'mode');
}

const settings = resolveConfig(defaults, { precision: 30 }, validate);
// Readonly<Config>, shallow-frozen at runtime
```

Validators are synchronous assertions, not transformations or boolean predicates. JavaScript callers must follow that same contract: returning false does not reject input. Validation cannot modify the frozen outer record and must not mutate nested values. As with any TypeScript assertion, the caller is responsible for truthfully establishing the asserted type.

## Shared contract

- Defaults declare the entire allowed key set. Include optional fields with an explicit undefined default if updates may set them; type declarations alone do   not establish runtime keys.
- Inputs must be plain records with the local Object.prototype or a null prototype. Arrays, class instances and foreign-realm Object prototypes are rejected.
- All own keys count, including symbols and non-enumerable properties. Unknown keys throw TypeError even when their value is undefined. Inherited keys are ignored.
- Accessors throw TypeError without invoking the getter. Proxy reflection traps may still run and their errors propagate.
- Outputs have Object.prototype and enumerable own data properties. A literal `__proto__` key is handled as data and never changes the prototype.
- Merging and freezing are shallow. Nested objects and arrays are replaced as whole values, retained by reference, and neither copied nor frozen. Use immutable nested defaults or explicitly copy/validate them in the consumer before resolving.
- Inputs are not mutated. Every successful call returns a new object, including no-op updates; consumers using identity-based caches should resolve once and reuse the resulting configuration.

Cache configuration now uses `resolveConfig`. Its limits and undefined inheritance remain unchanged; configuration accessors and non-plain objects are now rejected.
