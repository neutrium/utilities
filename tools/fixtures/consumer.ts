import { LruCache, BudgetCache, WeakCacheRegistry } from '@neutrium/utilities/cache';
import { AsyncLazy, SerialOperationQueue } from '@neutrium/utilities/async';
import { immutableSnapshot, isImmutableSnapshot } from '@neutrium/utilities/immutable';
import { mergeDefined } from '@neutrium/utilities/configuration';
import { numberAdapter, doubleAdapter, floatAdapter, type ArithmeticAdapter } from '@neutrium/utilities/numeric';
import { numberAdapter as numberEntry } from '@neutrium/utilities/number';
import { floatAdapter as floatEntry } from '@neutrium/utilities/float';

function check(condition: boolean): void {
    if (!condition) throw new Error('Packed consumer integration failed');
}

// Quantity-style generic algorithms and configuration-scoped caches.
export function mean<T>(numeric: ArithmeticAdapter<T>, a: T, b: T): T {
    return numeric.div(numeric.add(a, b), numeric.from(2));
}
check(numberAdapter === numberEntry && doubleAdapter === numberEntry && floatAdapter === floatEntry);
check(mean(numberAdapter, 2, 4) === 3);
check(floatAdapter.from(16777217) === 16777216);
const scopes = new WeakCacheRegistry<object, BudgetCache<number>>(() =>
    new BudgetCache({ maxEntries: 2, maxBytes: 1024 }, { measure: () => 8 }));
const cache = scopes.get(numberAdapter.config);
check(cache.trySet('mean', mean(numberAdapter, 2, 4)));
check(scopes.get(numberEntry.config).get('mean') === 3);

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
