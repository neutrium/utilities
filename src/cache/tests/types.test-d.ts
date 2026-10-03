import { expectTypeOf, test } from 'vitest';
import { LruCache, WeightedLruCache, BudgetCache, WeakCacheRegistry, cacheConfig,
	type CacheStats, type BudgetCacheStats, type CachePolicy } from '@neutrium/utilities/cache';
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
    const policy: CachePolicy<{ text: string }> = { measure: value => value.text.length * 2, detach: value => ({ ...value }) };
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
    void [value, admitted, budgetStats, optional, scoped];
    expectTypeOf(cache.set('a', 1)).toEqualTypeOf<typeof cache>();
    expectTypeOf(registry.get({ precision: 2 })).toEqualTypeOf<LruCache<string, number>>();
});
