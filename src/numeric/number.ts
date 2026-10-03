import { createBinaryAdapter } from './adapters/createBinaryAdapter.js';

export type { BinaryAdapter, BinaryConfig } from './adapters/createBinaryAdapter.js';

/** Complete immutable IEEE-754 binary64 arithmetic and scientific adapter. */
export const numberAdapter = createBinaryAdapter('binary64');
