/*
//	NeutriumJS.utilities.nestedMap
//	
//	A collection object for storing nested maps
//	
//	Original implementation from https://github.com/gentooboontoo/js-quantities/
*/

(function (root, factory) {
    "use strict";

	if(typeof define === "function" && define.amd) 
	{
		define('NeutriumJS/utilities/nestedMap', factory);
	} 
	else if (typeof exports === "object")
	{
		module.exports = factory();
	}
	else
	{
		root.NeutriumJS = root.NeutriumJS || {utilities: {}};
		root.NeutriumJS.utilities = root.NeutriumJS.utilities || {};
		root.NeutriumJS.utilities.nestedMap = factory();
	}
}(this, function() {
	"use strict";

	// Nested Map data type
	function NestedMap()
	{
	}

	NestedMap.prototype = {
	
		get: function(keys) {
			// Allows to pass key1, key2, ... instead of [key1, key2, ...]
			if(arguments.length > 1)
			{
				// Slower with Firefox but faster with Chrome than
				// Array.prototype.slice.call(arguments)
				// See http://jsperf.com/array-apply-versus-array-prototype-slice-call
				keys = Array.apply(null, arguments);
			}

			//function reduce
			
			return keys.reduce(function(map, key, index) {
				if (map)
				{
					var childMap = map[key];

					if (index === keys.length - 1)
					{
						return childMap ? childMap.data : undefined;
					}
					else
					{
						return childMap;
					}
				}
			}, this);
		},

		set: function(keys, value) {
			
			if(arguments.length > 2)
			{
				keys = Array.prototype.slice.call(arguments, 0, -1);
				value = arguments[arguments.length - 1];
			}

			return keys.reduce(function(map, key, index) {
				var childMap = map[key];
				
				if (childMap === undefined)
				{
					childMap = map[key] = {};
				}

				if (index === keys.length - 1)
				{
					childMap.data = value;
					return value;
				}
				else
				{
					return childMap;
				}
			}, this);
		}
	};
	
	return NestedMap;
}));