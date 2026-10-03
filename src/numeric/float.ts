import { createBinaryAdapter } from './adapters/createBinaryAdapter.js';

export type { BinaryAdapter, BinaryConfig } from './adapters/createBinaryAdapter.js';

/** Complete immutable adapter that rounds operands and results to IEEE-754 binary32. */
export const floatAdapter = createBinaryAdapter('binary32');
