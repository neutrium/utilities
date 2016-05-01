//
//	NeutriumJS.utilities.nestedMap
//
//	A collection object for storing nested maps
//
//	Original implementation from https://github.com/gentooboontoo/js-quantities/
//
"use strict";
var NestedMap = (function () {
    function NestedMap() {
    }
    NestedMap.prototype.get = function (keys) {
        return keys.reduce(function (map, key, index) {
            if (map) {
                var childMap = map[key];
                if (index === keys.length - 1) {
                    return childMap ? childMap.data : undefined;
                }
                else {
                    return childMap;
                }
            }
        }, this);
    };
    NestedMap.prototype.set = function (keys, value) {
        return keys.reduce(function (map, key, index) {
            var childMap = map[key];
            if (childMap === undefined) {
                childMap = map[key] = {};
            }
            if (index === keys.length - 1) {
                childMap.data = value;
                return value;
            }
            else {
                return childMap;
            }
        }, this);
    };
    return NestedMap;
}());
exports.NestedMap = NestedMap;
