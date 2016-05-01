//
//  Type guards for the NeutriumJS library
//

export namespace typeguards
{
    export function isNumber(x: any): x is number
    {
        return typeof x === "number" && isFinite(x);
    }

    export function isString(x: any): x is string
    {
        return typeof x === "string";
    }
}