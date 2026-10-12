import { expectTypeOf, test } from 'vitest';
import { BigIntAdapter } from '@neutrium/utilities/bigint';
import type { ArithmeticAdapter } from '@neutrium/utilities/numeric/arithmetic';

test('BigInt satisfies the arithmetic contract without scientific methods', () => {
	const numeric: ArithmeticAdapter<bigint> = new BigIntAdapter();
	// @ts-expect-error Adapter compatibility is a consumer policy, not an identity token.
	numeric.identity;
	// @ts-expect-error Concrete adapters do not expose an identity token either.
	new BigIntAdapter().identity;
	expectTypeOf(numeric.add(1n, 2n)).toEqualTypeOf<bigint>();
	expectTypeOf(numeric.powInteger(2n, 3)).toEqualTypeOf<bigint>();
	expectTypeOf(numeric.toBytes(2n)).toEqualTypeOf<number>();
	// @ts-expect-error Native Number operands must be explicitly converted.
	numeric.add(1, 2n);
	// @ts-expect-error Direct conversions still require a native BigInt operand.
	new BigIntAdapter().toNumber(1);
	// @ts-expect-error Byte sizing still requires a native BigInt operand.
	new BigIntAdapter().toBytes('255');
	// @ts-expect-error Predicates on typed operands do not replace isValue.
	new BigIntAdapter().isFinite(1);
	// @ts-expect-error Even a zero exponent requires a BigInt base.
	new BigIntAdapter().powInteger(1, 0);
	// @ts-expect-error Exponents use the arithmetic contract's Number integer input.
	numeric.powInteger(2n, 3n);
	// @ts-expect-error BigInt does not expose scientific operations.
	new BigIntAdapter().sqrt(4n);
});
