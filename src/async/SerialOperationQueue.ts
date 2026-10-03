/**
 * Serializes synchronous and asynchronous operations in submission order.
 * Each result settles independently; failures do not prevent subsequent work.
 * Disposal immediately closes admission, then runs cleanup once after accepted work.
 *
 * @remarks
 * Operations start in a Promise microtask, never inline. Return or await all work
 * that must be serialized. Do not await work queued behind the current operation
 * on this same queue: that creates a dependency cycle.
 */
export class SerialOperationQueue
{
	private accepting = true;
	private tail: Promise<void> = Promise.resolve();
	private disposal: Promise<void> | undefined;

	/**
	 * Create an independent queue.
	 * @param inactiveMessage - Error message for work submitted after disposal is requested.
	 */
	constructor(private readonly inactiveMessage = 'SerialOperationQueue is closed') {}

	/** True as soon as disposal is requested, even while accepted work is still running. */
	get closed(): boolean
	{
		return !this.accepting;
	}

	/**
	 * Submit an operation and receive its own result or rejection.
	 * @param operation - Callback returning a value, Promise or PromiseLike value.
	 * @returns A Promise that adopts the callback's result. Closed queues and invalid
	 * callbacks return rejected Promises without invoking or admitting the callback.
	 */
	run<T>(operation: () => T): Promise<Awaited<T>>
	{
		if (!this.accepting)
		{
			return Promise.reject(new Error(this.inactiveMessage));
		}

		if (typeof operation !== 'function')
		{
			return Promise.reject(new TypeError('operation must be a function'));
		}

		return this.append(operation);
	}

	/**
	 * Wait for work accepted before this call to settle, without closing admission.
	 * @returns A fulfilled Promise after that snapshot of work finishes, even if an
	 * operation failed. Work submitted later is excluded. Inspect individual result
	 * Promises, including dispose(), to observe failures.
	 */
	onIdle(): Promise<void>
	{
		return this.tail;
	}

	/**
	 * Close admission immediately and enqueue optional cleanup after accepted work.
	 * @param operation - Cleanup callback. Only the first accepted cleanup is used.
	 * @returns The same Promise on every valid call, including after cleanup fails. Cleanup
	 * is never retried. Invalid callbacks reject even after disposal has been requested;
	 * an invalid initial callback does not close the queue.
	 */
	dispose(operation: () => void | PromiseLike<void> = () => {}): Promise<void>
	{
		if (typeof operation !== 'function')
		{
			return Promise.reject(new TypeError('operation must be a function'));
		}

		if (!this.disposal)
		{
			this.accepting = false;
			this.disposal = this.append(operation);
		}

		return this.disposal;
	}

	private append<T>(operation: () => T): Promise<Awaited<T>>
	{
		const result = this.tail.then(() => Promise.resolve(operation()));

		// Retain only completion, not operation values/errors, and recover the chain.
		this.tail = result.then(() => undefined, () => undefined);

		return result;
	}
}
