# NeutriumJS.utilities

## Introduction

@neutriumJS/utilities is a collection of general purpose utility objects for use throughout the neutrium ecosystem of libraries.

## Getting Started

### Installing

The utilities module can be installed using npm as follows:

    npm install --save "@neutrium/utilities"

### Requirements

This package is ESM only and requires Node.js 24 or later. Development uses TypeScript 6.0.3 and pnpm 11.5.0.

#### TypeScript and Node.js

Use an ES module import in TypeScript or JavaScript:

```ts
import { LruCache, assertPositiveSafeInteger } from "@neutrium/utilities";

const capacity = 128;
assertPositiveSafeInteger(capacity, 'capacity');
const cache = new LruCache<string, number>(capacity);
cache.set('example', 42);
```

## Development

```sh
pnpm install
pnpm run verify
```

The build emits JavaScript ES modules and TypeScript declarations in `dist`. Packing the package rebuilds these files automatically. Feature tests live in `src/cache/tests`, `src/validation/tests`, `src/configuration/tests`, `src/integer/tests`, `src/numeric/tests`, `src/decimal/tests`, `src/async/tests`, and `src/immutable/tests`; root tests cover the package entry point. Vitest runs the runtime tests (`*.test.mjs`) and compiler-only type tests (`*.test-d.ts`) after building the package. Both test sets import the public package entry points, checking the emitted JavaScript and declarations. Type tests share the root `tsconfig.tests.json`; their intentionally invalid examples are never executed.

Run `pnpm test` to build and test, `pnpm run test:built` to test an existing build, or `pnpm run test:types` to build and run only the type tests. Vitest configuration lives in `vitest.config.js`.

Run `pnpm run test:package` to check the npm tarball in isolated consumers, including
all entry points, CommonJS rejection, and Node16/NodeNext/Bundler declaration resolution
with and without the optional Decimal peer. Packed-consumer fixtures also compile
and execute generic arithmetic, scoped caches, immutable specifications and queued
resource initialization with strict consumer compiler settings. These checks run in `pnpm run verify`
and the Node 24 and 26 CI jobs. Packing inside this check skips lifecycle scripts to
avoid invoking release verification recursively; the build runs beforehand.

CI runs on branch pushes and pull requests using a frozen lockfile. The documentation
workflow also verifies `master` before deploying to GitHub Pages. The release workflow
verifies tagged releases before publishing to npm.

Generated `dist` files are ignored by Git but included in the npm package. Commit
source files and the lockfile; `prepack` builds the JavaScript and declarations when
packing or publishing. After cloning the repository, run `pnpm install` and
`pnpm run build` before using its local package exports.

## Documentation

The [API documentation and feature guides](https://neutrium.github.io/utilities/) are generated with TypeDoc. Build them locally with `pnpm run docs`, then open `docs/index.html`. Generated files are ignored by Git and excluded from the npm package. `pnpm run verify` runs the package tests and builds the documentation, treating
documentation warnings as errors.

To build and preview the documentation locally:

```sh
pnpm run docs:dev
```

## License

This project is licensed under the MIT License, see the [LICENCE](./LICENCE) file for details.

You are free to:

- Use this plugin for personal or commercial purposes
- Modify and distribute the code
- Include it in other projects

Under the following conditions:

- You must include the original license and copyright notice

### Disclaimer

This plugin is provided "as is", without warranty of any kind. Use at your own risk.
