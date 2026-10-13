# Benchmarks

Run the native Number adapter dispatch benchmark from the Utilities checkout:

```sh
pnpm run benchmark
```

The command builds Utilities and runs its compiled ESM through Vitest. No Quantity
package is required. Mean timings are printed in milliseconds per batch, and the
latest detailed report is saved to `benchmark/results/vitest.json`. To rerun an existing build with longer measurements:

```sh
BENCH_TIME_MS=1000 BENCH_WARMUP_MS=500 pnpm run benchmark:built
BENCH_REVERSE=1 BENCH_TIME_MS=1000 BENCH_WARMUP_MS=500 pnpm run benchmark:built
```

## Numeric adapter dispatch

The cases compare direct `+`, `NumberAdapter.add`, and an adapter passed as a stable
function parameter. Each callback performs 65,536 additions over runtime-generated
doubles. Results are validated before and after measurement, outside the timed loop.
Divide milliseconds per batch by 65,536 and multiply by 1,000,000 for amortized
nanoseconds per addition. Array access, loop costs and result retention are shared
across cases.

`BENCH_TIME_MS` defaults to 500 and `BENCH_WARMUP_MS` to 250; both must be positive
numbers of milliseconds. `BENCH_REVERSE=1` reverses case order. Compare several
independent processes in both orders to assess run-to-run variation.

This measures warmed, stable dispatch that the JavaScript engine can inline. It
does not establish the cost of cold calls, changing backends at one call site, or
complete Quantity operations. Native ESM execution avoids instrumenting adapter
accesses through Vite's module runner. The dedicated benchmark configuration keeps
these timings separate from normal unit tests.

## Historical measurements

Before this benchmark moved from Quantity to Utilities, an Apple M4 Pro running
Node 26.5.0 produced medians of five independent process means of 0.517 ns/addition
for direct `+`, 0.516 ns for `numberAdapter.add`, and 0.516 ns for the stable injected
adapter. Each process used 500 ms of warmup and 1,000 ms of measurement per case,
with alternating case order. No consistent slowdown was observed; the differences
were within run-to-run variation. These are historical measurements, not results
for the current Utilities checkout.

The existing local archive moved to `benchmark/results/numeric-adapter-runs.json`.
Its package version and commit metadata still identify the original Quantity
checkout. Local result archives are ignored by Git and excluded from npm packages;
they are not included in a fresh checkout.
