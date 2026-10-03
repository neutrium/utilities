import type { ScientificAdapter } from './ScientificAdapter.js';
import { literal } from '../literal.js';

/** Fixed binary floating-point settings. */
export interface BinaryConfig
{
	/** IEEE-754 storage precision modeled by this adapter. */
	readonly format: 'binary32' | 'binary64';
	/** Arithmetic result quantization rule. */
	readonly rounding: 'nearest-even';
}

/** Complete native arithmetic and scientific adapter at a fixed binary precision. */
export interface BinaryAdapter extends ScientificAdapter<number>
{
	/** Immutable binary precision settings. */
	readonly config: Readonly<BinaryConfig>;
}

/** @internal Construct a complete immutable native-number adapter. */
export function createBinaryAdapter(format: BinaryConfig['format']): BinaryAdapter
{
	const config = Object.freeze({ format, rounding: 'nearest-even' as const });
	const read = binaryRead(format);
	const from = (value: unknown) => read(Number(literal(value)));
	const unary = (fn: (a: number) => number) => (a: number) => read(fn(read(a)));
	const binary = (fn: (a: number, b: number) => number) => (a: number, b: number) => read(fn(read(a), read(b)));

	return Object.freeze({
		id: format === 'binary32' ? 'float32' : 'number', tier: 'scientific',
		identity: Object.freeze({ format }), config,
		isValue: (value: unknown): value is number => typeof value === 'number' &&
			(format === 'binary64' || Number.isNaN(value) || Object.is(Math.fround(value), value)),
		from,
		compare(a: number, b: number)
		{
			a = read(a); b = read(b);
			return Number.isNaN(a) || Number.isNaN(b) ? NaN : a < b ? -1 : a > b ? 1 : 0;
		},
		isFinite: (value: number) => Number.isFinite(read(value)),
		isNaN: (value: number) => Number.isNaN(read(value)),
		isInteger: (value: number) => Number.isInteger(read(value)),
		toNumber: read,
		toString(value: number) { value = read(value); return Object.is(value, -0) ? '-0' : String(value); },
		add: binary((a, b) => a + b), sub: binary((a, b) => a - b),
		mul: binary((a, b) => a * b), div: binary((a, b) => a / b), rem: binary((a, b) => a % b),
		neg: unary(a => -a), abs: unary(Math.abs), floor: unary(Math.floor),
		ceil: unary(Math.ceil), trunc: unary(Math.trunc), round: unary(Math.round),
		pow: (a: number, exponent: string | number | bigint) => read(read(a) ** from(exponent)),
		sqrt: unary(Math.sqrt), cbrt: unary(Math.cbrt), exp: unary(Math.exp), ln: unary(Math.log),
		log: (a: number, base: number) => read(Math.log(read(a)) / Math.log(read(base))),
		atan2: (y: number, x: number) => read(Math.atan2(read(y), read(x))),
		pi: () => read(Math.PI),
		sin: unary(Math.sin),
		cos: unary(Math.cos),
		tan: unary(Math.tan),
		asin: unary(Math.asin),
		acos: unary(Math.acos),
		atan: unary(Math.atan),
		sinh: unary(Math.sinh),
		cosh: unary(Math.cosh),
		tanh: unary(Math.tanh),
		asinh: unary(Math.asinh),
		acosh: unary(Math.acosh),
		atanh: unary(Math.atanh),
	});
}

/** @internal Validate native operands and apply precision boundaries. */
function binaryRead(format: BinaryConfig['format']): (value: number) => number
{
	return value => {
		if (typeof value !== 'number')
		{
			throw new TypeError('Expected a Number operand');
		}

		return format === 'binary32' ? Math.fround(value) : value;
	};
}
