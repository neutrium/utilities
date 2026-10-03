import { expect, test } from 'vitest';
import { runInNewContext } from 'node:vm';
import * as guards from '@neutrium/utilities/validation';
import * as root from '@neutrium/utilities';

const constructors = [Float32Array, Float64Array, Uint8Array, Uint32Array];
for (const Constructor of constructors)
{
	const guard = guards[`is${Constructor.name}`];
	test(`${Constructor.name} recognizes local, foreign and subclass views`, () => {
		expect(root[`is${Constructor.name}`]).toBe(guard);
		expect(guard(new Constructor(0))).toBe(true);
		expect(guard(new Constructor(new ArrayBuffer(32), 8, 2))).toBe(true);
		expect(guard(runInNewContext(`new ${Constructor.name}(2)`))).toBe(true);
		class Subclass extends Constructor {}
		expect(guard(new Subclass(1))).toBe(true);
		expect(guard(new Constructor(new SharedArrayBuffer(32)))).toBe(true);
		const detached = new Constructor(2);
		structuredClone(detached.buffer, { transfer: [detached.buffer] });
		expect(guard(detached)).toBe(true); // brand, not buffer usability
	});
	test(`${Constructor.name} rejects other brands, spoofed tags and proxies without getters`, () => {
		let reads = 0;
		const fake = { get [Symbol.toStringTag]() { reads++; return Constructor.name; } };
		const real = new Constructor(1);
		Object.defineProperty(real, Symbol.toStringTag, { get() { reads++; return 'Fake'; } });
		expect(guard(real)).toBe(true);
		const revoked = Proxy.revocable(real, {});
		revoked.revoke();
		for (const value of [fake, Object.create(Constructor.prototype), new Proxy(real, {}), revoked.proxy,
			new DataView(new ArrayBuffer(8)), new Uint8ClampedArray(), new Int32Array(), new BigInt64Array(),
			null, undefined, [], {}, 1, ...constructors.filter(other => other !== Constructor).map(other => new other())]) {
			expect(guard(value)).toBe(false);
		}
		expect(reads).toBe(0);
	});
}
