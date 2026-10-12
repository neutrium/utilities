import { expectTypeOf, test } from 'vitest';
import { LruCache, WeightedLruCache, BudgetCache, WeakCacheRegistry, GenerationalWeakCache, cacheConfig,
	type CacheStats, type BudgetCacheStats, type CachePolicy, type CacheConfig, type CacheConfigOptions } from '@neutrium/utilities/cache';
import { LruCache as RootCache } from '@neutrium/utilities';

test('cache public type contract', () => {
    const cache: RootCache<string, number | undefined> = new LruCache<string, number | undefined>(2);
    const chain: typeof cache = cache.set('a', undefined);
    const value: number | undefined = chain.get('a');
    const admitted: boolean = cache.trySet('b', 1);
    const stats: CacheStats = cache.stats;
    // @ts-expect-error stats are immutable
    stats.entries = 1;
    // @ts-expect-error wrong key
    cache.set(2, 1);
    // @ts-expect-error wrong value
    cache.set('a', 'wrong');
    const weighted = new WeightedLruCache<string, Uint8Array>({ maxWeight: 100, weigh: (_key, bytes) => bytes.byteLength });
    weighted.set('bytes', new Uint8Array(3));
    // @ts-expect-error weighted caches require an explicit measurement callback
    new WeightedLruCache({ maxWeight: 100 });
    const options: CacheConfigOptions = { name: 'cache.parser', reuse: true };
    const parent = cacheConfig({ maxEntries: 4 });
    expectTypeOf(cacheConfig(undefined, parent, options)).toEqualTypeOf<CacheConfig>();
    // @ts-expect-error reuse is boolean
    cacheConfig(undefined, parent, { reuse: 'yes' });
    // @ts-expect-error cache limit names remain checked
    cacheConfig({ maxByte: 4 });
    const policy: CachePolicy<{ text: string }> = { measure: value => value.text.length * 2, detach: value => ({ ...value }), detachKey: key => key.slice(0) };
    // @ts-expect-error key ownership copies must return strings
    const invalidPolicy: CachePolicy<number> = { measure: () => 8, detachKey: () => 1 };
    void invalidPolicy;
    const budget = new BudgetCache(cacheConfig({ maxBytes: 1000 }), policy);
    budget.set('a', { text: 'hello' });
    const budgetStats: BudgetCacheStats = budget.stats;
    const optional: BudgetCache<{ text: string }> | undefined = BudgetCache.create({ maxEntries: 0 }, policy);
    // @ts-expect-error budget keys are strings
    budget.set({}, { text: 'hello' });
    const registry = new WeakCacheRegistry((key: { precision: number }) => new LruCache<string, number>(key.precision));
    const scoped: LruCache<string, number> = registry.get({ precision: 2 });
    // @ts-expect-error weak registries require object keys
    registry.get('key');
    const generations = new GenerationalWeakCache<object, number | undefined>(2);
    expectTypeOf(generations.set({}, 1)).toEqualTypeOf<typeof generations>();
    expectTypeOf(generations.get({})).toEqualTypeOf<number | undefined>();
    expectTypeOf(generations.trySet({}, undefined)).toEqualTypeOf<boolean>();
    // @ts-expect-error generational caches require object keys
    generations.set('key', 1);
    // @ts-expect-error values retain their declared type
    generations.set({}, 'value');
    // @ts-expect-error generation capacity is a number
    new GenerationalWeakCache('2');
    void [value, admitted, budgetStats, optional, scoped];
    expectTypeOf(cache.set('a', 1)).toEqualTypeOf<typeof cache>();
    expectTypeOf(registry.get({ precision: 2 })).toEqualTypeOf<LruCache<string, number>>();
});
