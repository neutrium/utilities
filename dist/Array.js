//
//  Array utility functions
//
"use strict";
// Compares two arrays
function compareArray(array1, array2) {
    if (array2.length !== array1.length) {
        return false;
    }
    for (var i = 0; i < array1.length; i++) {
        if (array2[i].compareArray) {
            if (!array2[i].compareArray(array1[i])) {
                return false;
            }
        }
        if (array2[i] !== array1[i]) {
            return false;
        }
    }
    return true;
}
exports.compareArray = compareArray;
