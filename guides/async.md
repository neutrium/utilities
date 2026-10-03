---
title: Async guide
---

# Asynchronous operations

`SerialOperationQueue` serializes access to an asynchronous resource and provides ordered, terminal cleanup.

```ts
import { SerialOperationQueue } from '@neutrium/utilities/async';

const operations = new SerialOperationQueue('Generator has been destroyed');
const first = operations.run(async () => {
    // Return or await all resource work that must finish before the next callback.
    return 42;
});
const second = operations.run(() => 100);

await Promise.all([first, second]);
await operations.dispose(async () => {
    // Release the resource once, after all accepted work has settled.
});
```

The class is also exported from `@neutrium/utilities`.

## Contract

| API | Behavior |
| --- | --- |
| `new SerialOperationQueue(message?)` | Creates an independent open queue. The default rejection message is `SerialOperationQueue is closed`. |
| `run(operation)` | Accepts a synchronous, Promise-returning or PromiseLike-returning callback; returns a Promise for that callback's result. |
| `closed` | Becomes true immediately when disposal is requested, including while prior work or cleanup is still pending. |
| `onIdle()` | Returns a completion snapshot for work accepted before this call. It does not close admission or include later submissions. |
| `dispose(cleanup?)` | Closes admission immediately, then invokes the first cleanup once after accepted work settles. Cleanup is optional. |

Callbacks start in Promise microtasks rather than inline, and accepted callbacks run in invocation order. A callback does not begin until the preceding callback's result has settled. Synchronous throws and asynchronous rejections propagate through each operation's own result Promise without blocking the following operation.

`dispose` is idempotent and returns the **same Promise object** on every valid call, even  when cleanup fails. Later valid cleanup callbacks are ignored. Cleanup rejection leaves the queue closed and does not trigger an automatic retry. Accepted operations still execute if disposal is requested while they are waiting. Later `run` calls reject without invoking the supplied callback.

`onIdle` waits for settlement, not success: it fulfills even after an operation or cleanup rejects. Observe the individual `run`/`dispose` Promises for errors. Calling `onIdle` after disposal includes cleanup; calling it beforehand does not include a subsequently requested cleanup.

Invalid callbacks return rejected Promises with TypeError. An invalid first disposal callback does not close the queue. Callbacks are validated even after disposal has been accepted; later valid callbacks are ignored and the original disposal Promise is returned.

The queue does not provide cancellation, retries, timeouts or capacity limits. An operation that never settles blocks later work and cleanup. Do not await a `run`, `dispose` or `onIdle` Promise queued behind the currently executing operation on the same queue: doing so creates a dependency cycle. Enqueuing follow-up work without awaiting it inside the current callback is allowed. Unreturned background work is outside the serialization guarantee.

## Shared asynchronous initialization

```ts
import { AsyncLazy } from '@neutrium/utilities/async';

const available = new AsyncLazy(probeAvailability, result => result === true);
const [first, second] = await Promise.all([available.get(), available.get()]);
available.clear();
```

`AsyncLazy<T>` accepts a synchronous or asynchronous factory and an optional synchronous `shouldCache(value)` predicate. The factory starts in a microtask on the first `get()`. Concurrent callers receive the same Promise. By default all fulfilled values are retained, including undefined, false and null. Returned objects are shared without copying or freezing.

A false predicate result is delivered to current callers but forgotten for future calls. Factory throws, thenable rejections and predicate errors reject the attempt and allow retry on the next `get()`. A nonboolean predicate result is a TypeError. The predicate is evaluated once per fulfilled attempt, including attempts invalidated while pending.

`clear()` forgets the pending or fulfilled Promise without cancelling its work or disposing its value. Even a scheduled factory that has not started still runs for its existing callers. An old attempt cannot overwrite or clear a newer one. Consumers own resource cleanup and must not await the same lazy instance from its factory or retention predicate, which would create a dependency cycle. There are no automatic retries or cancellation timers.
