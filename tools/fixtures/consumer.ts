import { LruCache, BudgetCache, WeakCacheRegistry, GenerationalWeakCache, cacheConfig } from '@neutrium/utilities/cache';
import { AsyncLazy, SerialOperationQueue } from '@neutrium/utilities/async';
import { immutableSnapshot, isImmutableSnapshot } from '@neutrium/utilities/immutable';
import { mergeDefined } from '@neutrium/utilities/configuration';
import { NumberAdapter, type ArithmeticAdapter } from '@neutrium/utilities/numeric';
import { BigIntAdapter } from '@neutrium/utilities/bigint';
import { NumberAdapter as NumberEntry } from '@neutrium/utilities/number';
import { toSafeInteger, isConfigurableAdapter, type NumericOptions } from '@neutrium/utilities/numeric/helpers';

import { addFactor, reduceFactors, factorRatio, factoredValue, type Factors } from '@neutrium/utilities/numeric/factors';

function check(condition: boolean): void {
	if (!condition) throw new Error('Packed consumer integration failed');
}

// Quantity-style generic algorithms and consumer-owned caches.
export function mean<T>(numeric: ArithmeticAdapter<T>, a: T, b: T): T {
	return numeric.div(numeric.add(a, b), numeric.from(2));
}
const integers: ArithmeticAdapter<bigint> = new BigIntAdapter();
check(integers.add(integers.from('9007199254740993'), 1n) === 9007199254740994n);
check(integers.div(-7n, 3n) === -2n);
check(NumberAdapter === NumberEntry);
const numberAdapter = new NumberAdapter();
const native: ArithmeticAdapter<number> = new NumberAdapter();
check(native.add(2, 3) === 5);
check(mean(numberAdapter, 2, 4) === 3);
check(numberAdapter.from(16777217) === 16777217);
check(numberAdapter.powInteger(2, -3) === 0.125);
check(toSafeInteger('12e2') === 1200);
check(!isConfigurableAdapter(numberAdapter));
type FixedOptions = NumericOptions<typeof numberAdapter>;
// @ts-expect-error Fixed native adapters have no configuration options.
const fixedOptions: FixedOptions = {};
void fixedOptions;
const cacheLimits = cacheConfig({ maxEntries: 2, maxBytes: 1024 });
check(cacheConfig(undefined, cacheLimits, { name: 'consumer cache', reuse: true }) === cacheLimits);
check(cacheConfig(cacheLimits, undefined, { reuse: true }) === cacheLimits);
const scopes = new WeakCacheRegistry<object, BudgetCache<number>>(() =>
	new BudgetCache({ maxEntries: 2, maxBytes: 1024 }, { measure: () => 8, detachKey: key => key.slice(0) }));
const owner = {};
const cache = scopes.get(owner);
check(cache.trySet('mean', mean(numberAdapter, 2, 4)));
check(scopes.get(owner).get('mean') === 3);

const generations = new GenerationalWeakCache<object, number>(1);
const firstKey = {}, secondKey = {};
generations.set(firstKey, 1).set(secondKey, 2);
check(generations.get(firstKey) === 1);
generations.set({}, 3);
check(!generations.has(secondKey) && generations.has(firstKey));

// Formatter-style owned specifications and bounded Intl instances.
const source = { locale: 'en-AU', labels: ['distance'] };
const snapshot = immutableSnapshot(source);
source.labels.push('changed');
check(isImmutableSnapshot(snapshot) && snapshot.labels.length === 1);
const formats = new LruCache<string, Intl.NumberFormat>(2);
const format = new Intl.NumberFormat(snapshot.locale);
formats.set(snapshot.locale, format);
check(formats.get(snapshot.locale) === format);
const options = mergeDefined({ capacity: 2 }, { capacity: 4 });
check(options.capacity === 4);

// Rand-style resource initialization, ordered work, and disposal.
let initializations = 0;
const resource = new AsyncLazy(async () => ({ id: ++initializations }));
const queue = new SerialOperationQueue('Generator has been destroyed');
const values = await Promise.all([
	queue.run(async () => (await resource.get()).id),
	queue.run(async () => (await resource.get()).id),
]);
check(values[0] === 1 && values[1] === 1 && initializations === 1);
let disposed = false;
await queue.dispose(() => { disposed = true; });
check(disposed && queue.closed);

// Backend-independent integer factors work without the optional Decimal peer.
const factors: Factors = new Map();
addFactor(factors, 1000n, 1n);
addFactor(factors, 3600n, -1n);
const fraction = factorRatio(reduceFactors(factors));
check(fraction?.[0] === 5n && fraction[1] === 18n);
const rational = factoredValue(factors);
check('exact' in rational && rational.exact.numerator === 5n && rational.exact.denominator === 18n);


// Rational helpers and capability detection work without the optional Decimal peer.
import { parseRationalTerm, scaleTerm, negateValue, evaluateRational, hasRationalArithmetic,
	type RationalTerm, type RationalArithmeticAdapter } from '@neutrium/utilities/numeric/rational';
const rationalTerm: RationalTerm = parseRationalTerm('2.5');
check(scaleTerm(rationalTerm, 3n, 2n).numerator === 75n);
check(evaluateRational([negateValue({ exact: rationalTerm })], terms => terms[0]!.numerator) === -25n);
check(!hasRationalArithmetic(numberAdapter));
function rationalSign<T>(adapter: ArithmeticAdapter<T>): number | undefined {
	if (!hasRationalArithmetic(adapter)) return undefined;
	const exact: RationalArithmeticAdapter<T> = adapter;
	return exact.compareRationalSum([rationalTerm]);
}
check(rationalSign(numberAdapter) === undefined);
