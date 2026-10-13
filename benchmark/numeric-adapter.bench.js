import assert from 'node:assert/strict';
import { test } from 'vitest';
import { NumberAdapter } from '@neutrium/utilities/number';
const numberAdapter = new NumberAdapter();

function duration(name, fallback) {
	const value = Number(process.env[name] ?? fallback);
	assert(Number.isFinite(value) && value > 0, `${name} must be a positive number of milliseconds`);
	return value;
}

const options = {
	time: duration('BENCH_TIME_MS', 500),
	warmupTime: duration('BENCH_WARMUP_MS', 250),
	iterations: 64,
	warmupIterations: 64,
};

// Batch additions to amortize runner/timer overhead. Runtime-generated doubles
// prevent constant folding; the validated sum makes every addition observable.
// Reported timings are per batch, including identical array access and loop costs.
const batchSize = 65_536;
const values = Float64Array.from({ length: batchSize }, () => Math.random() - 0.5);

function direct() {
	let sum = 0;
	for (let i = 0; i < values.length; i++) sum += values[i];
	return sum;
}

function adapter() {
	let sum = 0;
	for (let i = 0; i < values.length; i++) sum = numberAdapter.add(sum, values[i]);
	return sum;
}

function injected(numeric) {
	let sum = 0;
	for (let i = 0; i < values.length; i++) sum = numeric.add(sum, values[i]);
	return sum;
}

test(`double addition: ${batchSize} additions per batch`, async ({ bench }) => {
	const expected = direct();
	const validate = result => assert.equal(result, expected);
	const cases = [
		{ name: 'direct +', run: direct, validate },
		{ name: 'numberAdapter.add', run: adapter, validate },
		{ name: 'injected stable adapter.add', run: () => injected(numberAdapter), validate },
	];
	// Allow independent runs in reverse order to expose ordering/thermal bias.
	if (process.env.BENCH_REVERSE === '1') cases.reverse();
	// Validate outside the timed callbacks and consume the final measured result.
	for (const entry of cases) entry.validate(entry.run());
	const registrations = cases.map(entry => bench(entry.name, () => { entry.result = entry.run(); }));
	await bench.compare(...registrations, options);
	for (const entry of cases) entry.validate(entry.result);
});
