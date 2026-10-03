/**
 * Share one asynchronous initialization and retain accepted results, including undefined.
 * Rejections are never retained. clear() invalidates the current attempt without cancelling
 * it; existing callers still receive its result. An old attempt cannot replace or clear a
 * newer one. Do not await this instance's get() inside its factory or retention predicate.
 */
export class AsyncLazy<T>
{
	private current: Promise<Awaited<T>> | undefined;

	/**
	 * @param factory - Invoked in a microtask on the first get() after construction or invalidation.
	 * Synchronous throws and rejected thenables become get() rejections.
	 * @param shouldCache - Optional synchronous predicate, evaluated once per successful attempt.
	 * False delivers the value without retaining it. A throw or nonboolean result rejects the
	 * attempt and allows retry. Defaults to retaining all fulfilled results.
	 */
	constructor(
		private readonly factory: () => T | PromiseLike<T>,
		private readonly shouldCache: (value: Awaited<T>) => boolean = () => true
	){
		if (typeof factory !== 'function')
		{
			throw new TypeError('factory must be a function');
		}

		if (typeof shouldCache !== 'function')
		{
			throw new TypeError('shouldCache must be a function');
		}
	}

	/** Return the same Promise for all callers until rejection, rejected retention, or clear(). */
	get(): Promise<Awaited<T>>
	{
		if (this.current)
		{
			return this.current;
		}

		const attempt = Promise.resolve().then(() => Promise.resolve(this.factory())).then(value => {
			const retain = this.shouldCache(value);

			if (typeof retain !== 'boolean')
			{
				throw new TypeError('shouldCache must return a boolean');
			}

			if (!retain && this.current === attempt)
			{
				this.current = undefined;
			}

			return value;
		}).catch((error: unknown) => {
			if (this.current === attempt)
			{
				this.current = undefined;
			}

			throw error;
		});

		this.current = attempt;

		return attempt;
	}

	/** Forget the pending or fulfilled attempt. Does not cancel work or dispose its result. */
	clear(): void
	{
		this.current = undefined;
	}
}
