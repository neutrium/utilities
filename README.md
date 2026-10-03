# @neutrium/utilities

A collection of general purpose utility objects for use throughout the neutrium ecosystem of libraries.

## Installation

The utilities module can be installed using npm as follows:

    pnpm install @neutrium/utilities

This package is ESM only and requires Node.js 24 or later. Development uses TypeScript 6.0.3 and pnpm 11.5.0.

## Quickstart

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

## Documentation

The [API documentation and feature guides](https://neutrium.github.io/utilities/) are generated with TypeDoc. Build them locally with `pnpm run docs`, then open `docs/index.html`. Generated files are ignored by Git and excluded from the npm package. `pnpm run verify` runs the package tests and builds the documentation, treating
documentation warnings as errors.

To build and preview the documentation locally:

```sh
pnpm run docs:dev
```

## License

## Overview

This project is licensed under the MIT License, see the [LICENCE](./LICENCE) file for details.

You are free to:

- Use this plugin for personal or commercial purposes
- Modify and distribute the code
- Include it in other projects

Under the following conditions:

- You must include the original license and copyright notice

### Disclaimer

This plugin is provided "as is", without warranty of any kind. Use at your own risk.
