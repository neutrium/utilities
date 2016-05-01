//
//  Type guards for the NeutriumJS library
//
"use strict";
var typeguards;
(function (typeguards) {
    function isNumber(x) {
        return typeof x === "number" && isFinite(x);
    }
    typeguards.isNumber = isNumber;
    function isString(x) {
        return typeof x === "string";
    }
    typeguards.isString = isString;
})(typeguards = exports.typeguards || (exports.typeguards = {}));
