const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayTag = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;

function hasBrand(value: unknown, brand: string): boolean
{
	if (!ArrayBuffer.isView(value))
	{
		return false;
	}

	return typedArrayTag.call(value) === brand;
}

/** Recognizes Float32Array across realms, without trusting an own toStringTag or accepting proxies. */
export function isFloat32Array(value: unknown): value is Float32Array
{
	return hasBrand(value, 'Float32Array');
}

/** Recognizes Float64Array across realms, without trusting an own toStringTag or accepting proxies. */
export function isFloat64Array(value: unknown): value is Float64Array
{
	return hasBrand(value, 'Float64Array');
}

/** Recognizes Uint8Array (including subclasses), excluding Uint8ClampedArray and DataView. */
export function isUint8Array(value: unknown): value is Uint8Array
{
	return hasBrand(value, 'Uint8Array');
}

/** Recognizes Uint32Array across realms, without trusting an own toStringTag or accepting proxies. */
export function isUint32Array(value: unknown): value is Uint32Array
{
	return hasBrand(value, 'Uint32Array');
}
